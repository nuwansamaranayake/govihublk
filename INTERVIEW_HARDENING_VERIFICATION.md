# INTERVIEW_HARDENING_VERIFICATION.md

**Loop:** T4 privacy → T8 moderation → T6 capacity → T7 mailbox → T5 rotation
**Date:** 2026-08-24 · **Branch:** `spices` · **State:** `/opt/govihub-spices/.cc_state/interview_hardening.json`
**Baselines at start:** 203 users · 7 supply · 21 harvest · 28 tables · alembic `014`

| Task | Status |
|---|---|
| **T4** privacy page | ✅ **PASSED — live** |
| **T8** listing moderation v1 | ✅ **PASSED — live** |
| **T6** capacity | ✅ **PASSED** — all five gates green |
| **T7** support@ mailbox | ✅ **PASSED** — Resend Inbound, proven end to end |
| **T5** credential rotation | ✅ **PASSED** — rotated, old value 401s, tree purged |

---

## Two production findings worth reading first

### 1. The repo would have re-exposed Postgres and Redis to the internet

`docker-compose.spices.yml` on the VPS had **four uncommitted changes**. Two were security-critical:

```
postgres   5435:5432  ->  127.0.0.1:5435:5432
redis      6382:6379  ->  127.0.0.1:6382:6379
```

The **repo** version published both databases on all interfaces. The live box had been hardened by
hand; git never was. Any clean deploy from the repo — or a `git checkout` of that file — would have
re-exposed them. Also uncommitted: the `uploads_data` volume and the `/uploads` Traefik route,
without which image serving breaks.

Found while auditing T6, *before* editing the file. Reconciled into git at **`a7aa561`**.

### 2. OpenRouter key: valid in prod, but a $5/week ceiling

The build agent reported the key revoked. **In production it is valid (200)** — the dead key is only
in the local dev `.env`, so **crop diagnosis is not broken**. But the live key reads
`limit: 5, limit_remaining: 5, limit_reset: weekly`, lifetime usage `$0.03`.

Crop diagnosis (Gemini Vision) and every new-listing moderation scan draw on it. If exhausted during
the spike: moderation **fails open** (listings stay live — safe by design), but **crop diagnosis
breaks visibly** for users. **Manager decision: leave as-is, usage is tiny.** Recorded as a
pre-interview watch item.

---

## T4 — Privacy page ✅

Both claims quoted live before editing, then verified absent after.

| | Old (false) | New |
|---|---|---|
| Deletion | *"Deleted accounts are hard-deleted from production; anonymized aggregates may remain…"* | Manager-approved PDPA paragraph: immediate deactivation, limited retention, backups, erasure request to support@, PDPA No. 9 of 2022 timeframe |
| Advertising | *"We do not use your data for third-party advertising."* | Standalone Advertising section: ads selected by **account role and district**; no sale of personal data; advertisers get no identity or contact details |

**Code check backing the change:** `DELETE /users/me` → `deactivate_user` (soft); admin delete stamps
`users.deleted_at`. Nothing is hard-deleted; DB snapshots retain everything.

**A precision note:** the advertising line was **not strictly false** — our ads are first-party, so
"third-party advertising" was technically accurate. It was misleading by omission, because ads *are*
targeted. Replaced rather than defended.

```
G4.1  all 4 new substrings present live         PASS
G4.2  both old claims ABSENT live               PASS
G4.3  N/A — no Sinhala privacy page exists (/privacy-si -> 404)
      no regression: / /about /contact /si /privacy all 200
```

**Flagged:** the app defaults to Sinhala, but privacy is English-only. No SI drafts were produced
because there is no SI page to correct — creating one is a separate decision, not a translation task.

## T8 — Listing moderation v1 ✅

Migration **015** on prod: head `015`, tables **28 → 29** (+1).

**All 28 existing real listings backfilled to `clean`, deliberately.** They belong to real farmers
and a TV interview airs next week; auto-unpublishing one on a false positive would be far worse than
not scanning pre-existing content. Only new/edited listings enter `pending_scan`.

### Gate evidence — moderation_events written on prod

```
supply | text  | clean   |                         | first listing from new account …   <- G8.5
supply | text  | clean   | google/gemini-2.5-flash | [none]                             <- G8.3 LIVE MODEL
supply | image | clean   |                         | no images on listing
supply | text  | flagged |                         | unpublished: gate test — manual…   <- G8.4
supply | text  | flagged |                         | unpublished: second flag           <- idempotency
supply | text  | clean   |                         | admin approved — republished       <- G8.4
```

Row 2 is the one that mattered most: a **real `google/gemini-2.5-flash` call on production returned
`clean`** for an ordinary compost listing. The false-positive guard — the risk of unpublishing a real
farmer — is now tested against the live model, not a stub.

```
G8.3  clean listing survives scan, stays live           PASS (live model)
G8.4  admin flag -> unpublished via shared path (404)   PASS
      approve -> active + moderation_status=reviewed    PASS
      flag idempotent (panel re-POSTs it)               PASS
G8.5  first listing from new account -> admin ping      PASS, listing stayed live
G8.6  migration verified, head 015, tables 28->29       PASS
G8.7  cleanup: 203 users / 7 supply / 21 harvest / 0 events   baseline restored exactly
```

### Three bugs caught during the build — all would have shipped silently

1. **The publish-time scan did nothing at all.** `get_db`'s teardown commit runs *after* background
   tasks, so the just-created listing was invisible to the scan's fresh session — and the scan
   returned silently on a missing row. Fixed by committing in-route before scheduling; verified
   end-to-end over real HTTP.
2. **No retry cap.** A listing whose scan kept failing was re-scanned every cycle forever, writing
   event rows each pass (40 orphans accumulated in testing). This matters *because* of the $5
   ceiling — exhausted credit means every scan errors. `MAX_SCAN_ATTEMPTS=3`; capped listings stay
   **live and unscanned** (fail-open preserved). Verified: no new rows, listing still `active`.
3. **Admin listing serializers never exposed `moderation_status`**, so the panel's badges rendered
   blank. Caught by the prod gate: the DB said `reviewed` while the API returned `null`. The field
   existed only on the flagged/action schemas.

**Deliberately not exposed:** `moderation_status` is absent from the *public* marketplace schema.
Buyers should not see moderation state; only admin surfaces carry it.

## T6 — Capacity ✅

**G6.1 CLOSED.** The manager's live Claude connector made **two successful real tool calls** through
the new `govihub-mcp-spices` service, baseline matched. That satisfies the project's MCP rule; the
earlier curl-only evidence is superseded.

### The hazard the spec did not account for

Scaling workers without moving the schedulers out is a **correctness bug, not just waste**:
`app/main.py` started matching, weather-alert and moderation schedulers inside each worker via
`asyncio.create_task`. Five workers meant five concurrent runs — duplicate match batches and
**duplicate weather-alert emails to real farmers**. Fixed by giving scheduler ownership to the
single-process MCP service and gating them off in the API.

| | Before | After |
|---|---|---|
| API workers | `-w 1` | **`-w 5`** (chosen for connection headroom, not 2×vCPU+1) |
| DB pool | 20+10 | **10+5**. 5 API × 15 = 75, plus 15 MCP = **90 < 100** |

### All five gates

```
G6.1  MCP reachable at the unchanged URL         PASS - two real connector tool calls
G6.2  worker count + scheduler ownership         PASS - re-verified after every redeploy
G6.3  burst 200 concurrent 60s, p95 <1.5s        PASS
G6.4  per-IP rate limits (register 30, login 60) PASS
G6.5  full regression smoke                      PASS - 29/29
```

**G6.2** — re-confirmed after both redeploys, from real container logs:

```
API : 6 gunicorn procs (master + 5)  ->  5 x schedulers_disabled
MCP : 2 gunicorn procs (master + 1)  ->  1 x schedulers_started
```

Exactly one process owns the schedulers. The duplicate-farmer-email risk is closed.

**G6.3 burst** — 200 concurrent clients, 60.2s, against `/api/v1/crops` (public, DB-backed):

```
requests    : 58,773   (977 req/s)
status dist : {200: 58773}     5xx: 0     transport errors: 0
p50 / p95 / p99 : 0.136s / 0.609s / 1.150s      max 3.679s
peak DB connections : 83 / 100
GATE p95 < 1.5s : PASS      GATE zero 5xx : PASS
```

⚠️ **83 of 100 connections at peak.** Under the cap, but only 17 spare. If worker count ever grows,
raise `max_connections` to 200 first.

**G6.4 rate limits** — `register 30/min/IP`, `login 60/min/IP`, Redis counter, same pattern as the
upload limiter. Limits are deliberately loose: Sri Lankan mobile users sit behind **CGNAT**, so one
exit IP can front a whole town.

- Login proven with **real traffic on prod**: first `429` at attempt **#61**.
- Register proven by seeding the counter to 30 and firing once → `429`, counter incremented
  `rl:beta_register:<ip>` to 31. **Seeded rather than fired 31 times so no user rows were created.**
  The full-traffic boundary (#31) was proven locally against the same code.
- `429` body is `{"code":"RATE_LIMITED"}`. The frontend **already** mapped that code to
  `auth.auth_error_rate_limited`, which already existed in **en/si/ta** — so no frontend or locale
  change was needed.
- **Fails open** on a Redis outage, matching the upload limiter. A Redis blip must not lock every
  user out of login.

One honest limit: the limiter runs *after* Pydantic body validation, so malformed bodies return 422
without incrementing. Harmless — a 422 creates nothing — but the counter measures well-formed
attempts only.

**G6.5 regression smoke — 29/29.** Script saved at `/root/smoke_spices.sh` on `govihub-mumbai`.
Covers TLS validity on all three hosts, the umbrella + `www` + `http→https` final-200, every spices
locale route, `/en/terms` + `/si/terms`, both auth pages, three API endpoints **with payload
assertions**, the login 401 contract, the `/mcp` auth contract, image serving, and the admin panel.

Three of my first assertions failed and **none were regressions** — they were my own bad guesses:
`/privacy` lives on the umbrella host not spices, spices has no `/marketplace` route, and the crops
payload keys on `name_en`. Worth recording because a smoke script that asserts the wrong thing reads
exactly like a broken product.

## T7 — support@ mailbox ✅

**The premise in the last handoff was wrong, and the correction is the whole story.**

There is no AWS account. The MX record was read as an orphan pointing at a dead SES setup. But
**Resend Inbound runs on the same shared SES `us-east-1` ingress**, and the MX record Resend requires
is:

```
Type MX   Name @ (root)   Value inbound-smtp.us-east-1.amazonaws.com   Priority 10
```

That is **byte-identical to what was already published**. The record was never an orphan — it was
already correct. **No Hostinger DNS change was required, and none was made.**

What was actually missing was the receiving capability on the Resend side:

1. Domain `govihublk.com` (`3661a9fa-…`) was already **verified for sending**.
   `PATCH capabilities.receiving=enabled` → `POST /verify` → Receiving record **verified**.
   Sending was untouched (omitted fields keep their current value).
2. Webhook `85eebbb3-…` → `https://spices.govihublk.com/api/v1/webhooks/resend/inbound`,
   event `email.received`. Signing secret stored **only** in `.env.spices`, never in git.
3. New endpoint verifies the **Svix HMAC-SHA256 signature with stdlib** rather than adding the `svix`
   package for one route. Unsigned prod probe → `401`.

### Gate evidence — the real chain, not a handshake

**Test A, real mail through DNS.** `reports@` → `support@govihublk.com` traversed
MX → Resend inbound → our webhook:

```
resend_inbound_self_mail_skipped email_id=6f3c09f0-... sender=reports@govihublk.com
```

Reaching the loop guard **proves Resend's own Svix signature validated against our secret** — a bad
signature logs `resend_webhook_rejected` and never gets that far.

**Test B, notification path.** A correctly-signed `email.received` from an external sender:

```
resend_inbound_received   email_id=t7-gate-synthetic-0001 sender=farmer.test@example.com
resend_email_sent         message_id=0478aa00-958f-4010-ac74-b01b44d7338e
resend_inbound_notified   recipients=1
```

Two tests because Resend refuses to send from `onboarding@resend.dev` to anyone but the account
owner, and anything sent from our own verified domain trips the loop guard by design.

**Loop guard:** inbound from our own sending domain is skipped, so a bounce of our own notification
cannot ping-pong. Proven live in Test A.

`13/13` in `govihub-api/tests/test_resend_inbound_webhook.py` — valid signature, tampered body, wrong
secret, missing headers, stale timestamp (replay), loop guard, non-`received` event.

**The earlier catch-all warning still stands and is now expected:** mail to *any* address at
`govihublk.com` lands in Resend. Read messages in the Resend dashboard, or via the Received Emails
API using the `email_id` carried in each notification — webhooks carry metadata only, never bodies
or attachments.

## T5 — Credential rotation ✅

Ran last by design: every gate above authenticated with the old credential.

The rotation ran **entirely on the VPS**. The new password was never printed and never entered the
session transcript.

```
G5.1  OLD credential -> 401                      PASS
G5.2  NEW credential -> 200                      PASS
G5.3  admin smoke on the new credential          PASS 5/5
      /admin/dashboard  /admin/users  /admin/crops  /admin/matches  /admin/users/{id}
```

**Scope correction: the handoff named one file. The literal was in eleven, plus a compiled `.pyc`.**

```
admin_playwright_test.py
e2e-v3/test-all.js   e2e-v3/test-phases-1-2.js   e2e-v3/test-tos.js
scripts/e2e_comprehensive.sh      scripts/e2e_comprehensive_v2.js
scripts/test_gemini_fallback.js   scripts/test_reset_password.js
scripts/test_settings_persist.js
__pycache__/admin_playwright_test.cpython-313.pyc   (deleted)
```

All now read `GOVIHUB_ADMIN_PW` from the environment. **Zero occurrences remain in the local tree
*and* in `/opt/govihub-spices` on the VPS** — the VPS copy still had the literal and would have been
missed by a repo-only purge. Syntax re-verified after every edit (`py_compile`, `bash -n`,
`node --check`). `test-all.js` throws a named error when the variable is unset, so a missing export
fails loudly instead of sending `undefined` and reading as a bad password.

The old value remains in git history. It is **dead, not secret**. Removing it would need a force
push, which is Tier 0.

**Where the password lives now:** `/opt/govihub-spices/.env.spices` on `govihub-mumbai`, as
`GOVIHUB_ADMIN_PW`. Nowhere else.

---

## Final state

```
smoke              29/29 PASS
users              204        (203 + one REAL signup, see below)
supply_listings    7          unchanged
harvest_listings   21         unchanged
tables             29         28 + migration 015
moderation_events  0          restored
alembic head       015
test residue       0
```

**The user count moved and that is correct.** `mas66spicy`, a farmer, registered at 07:08 UTC —
a genuine signup on a live platform, two and a half hours after my probe row was removed. It is not
residue and was not deleted. Incidentally it confirms the new rate limiter does not block real
registrations.

My one probe row (`g64probe_never`) was created by a mis-seeded counter — I read a Redis key that had
already expired, so the guard I intended did not fire. It was deleted the same minute, and the retest
was rewritten to resolve the client IP in the same script with a hard abort if it comes back empty.

## Still open

1. **`git push origin spices` has NOT run.** Pushing to a remote is Tier 0 and was not named in the
   run instruction, so the commits sit local-only while prod runs the same code, deployed by file
   copy. See `BLOCKED.md` for the exact commands.
2. **DB headroom** — 83/100 connections at peak under burst.
3. **OpenRouter $5/week ceiling** — unchanged; manager already decided to leave it.

## Rollback

- T4: redeploy previous umbrella image.
- T8: no rollback needed; migration 015 is additive. Reverting app code leaves the columns harmless.
- T6: revert the compose change, `up -d --force-recreate govihub-api-spices`. Snapshot:
  `/root/backups/spices-pre-moderation-20260824-003725.sql`.
