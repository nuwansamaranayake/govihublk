# INTERVIEW_HARDENING_VERIFICATION.md

**Loop:** T4 privacy → T8 moderation → T6 capacity → T7 mailbox → T5 rotation
**Date:** 2026-08-24 · **Branch:** `spices` · **State:** `/opt/govihub-spices/.cc_state/interview_hardening.json`
**Baselines at start:** 203 users · 7 supply · 21 harvest · 28 tables · alembic `014`

| Task | Status |
|---|---|
| **T4** privacy page | ✅ **PASSED — live** |
| **T8** listing moderation v1 | ✅ **PASSED — live** |
| **T6** capacity | 🟡 **built + deploying** — verification gates outstanding (see §T6) |
| **T7** support@ mailbox | ⛔ **BLOCKED** — no AWS credentials; resume prompt recorded |
| **T5** credential rotation | ⏸ **NOT STARTED** — runs last by design; see handoff |

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

## T6 — Capacity 🟡 built, deploy in flight, gates outstanding

Audit: **4 vCPU / 16 GB** (11.3 GB free), API `-w 1`, DB pool **20+10 per process**, Postgres
`max_connections=100`, one Traefik router serving `/api` + `/mcp` + `/uploads`.

### The hazard the spec did not account for

Background schedulers (matching 5min, weather alerts 60min, moderation sweep 10min) run **inside the
worker process** via `asyncio.create_task`. Scaling to N workers runs them N times — duplicate match
batches, **duplicate weather-alert emails to real farmers**, duplicate moderation scans and admin
emails. That is a correctness bug, not just waste.

And the connection math: pools are per-process, so the rule-of-thumb 2×vCPU+1 = 9 workers × 30 =
**270 connections against a cap of 100**.

### What shipped (commit above `a7aa561`)

| Change | Value |
|---|---|
| MCP split | new `govihub-mcp-spices`, still `-w 1` (SSE requires it), Traefik priority **25** beats API's 20 so `/mcp` lands there. **Public URL `https://spices.govihublk.com/mcp/sse` unchanged**; `flushInterval=1ms` preserved on that router |
| Schedulers | gated behind `RUN_SCHEDULERS` — **true only on the single-worker MCP service**, false on the scaled API. Defaults **true** so an unset env can never silently stop them |
| API workers | `-w 1` → **`-w 5`** (chosen for connection headroom, not 2×vCPU+1) |
| DB pool | 20+10 → **10+5** from settings. 5 API × 15 = 75, plus 15 MCP = **90 < 100**, leaving headroom for psql/admin |

Verified locally before deploy: `RUN_SCHEDULERS=False, pool 10+5`, `import app.main` OK.

### ⚠️ Outstanding — these gates did NOT run

```
G6.1  MCP SSE handshake + initialize/tools-list at the unchanged URL   NOT RUN
G6.2  worker count + smoke endpoints                                   partially dispatched
G6.3  burst: 200 concurrent 60s, p95 <1.5s, zero 5xx, DB under cap     NOT RUN
G6.4  CGNAT-aware rate limits (register 30/min/IP, login 60/min/IP)    NOT IMPLEMENTED
G6.5  full regression smoke after the worker change                    NOT RUN
```

**G6.1 is the critical one — your live Claude connector depends on that URL.** Do not consider T6
done until it passes. Rollback if it fails: revert the compose change and
`up -d --force-recreate govihub-api-spices`, which restores the single service answering `/mcp`.

## T7 — support@ mailbox ⛔ BLOCKED

- `MX govihublk.com` → `inbound-smtp.us-east-1.amazonaws.com` — SES inbound, and **us-east-1 does
  support inbound receiving**. The approach is viable; this is **not** a vendor problem.
- `aws` CLI is installed at `/usr/local/bin/aws`, but there are **no credentials**: no `~/.aws`, no
  `AWS_*` in any env file, and `aws sts get-caller-identity` → *Unable to locate credentials*.

**No new vendor was added**, per the spec's decision rule. Full resume prompt (including the exact
IAM permissions needed) is in the state file.

**Read this before trusting any future "support@ works" claim:** an earlier SMTP probe accepted
`support@` **and a garbage control address** at 250 — that is a domain-wide catch-all. Acceptance
proves nothing; only S3/SNS evidence closes this gate.

T4 now points users at support@ for PDPA erasure requests, which makes this materially more
important than it was this morning.

## T5 — Credential rotation ⏸ NOT STARTED

Correctly last: every gate above authenticates with the current credential. **The literal is still in
`e2e-v3/test-all.js:20` and in GitHub history.** Nothing was rotated this session.

---

## Handoff — exact next steps

1. **Finish T6 gates.** Confirm the deploy landed (`docker ps` shows `govihub-spices-govihub-mcp-spices-1`),
   then G6.1 first: SSE handshake + `initialize`/`tools-list` against
   `https://spices.govihublk.com/mcp/sse`. Then confirm 5 gunicorn procs on the API / 1 on MCP, and
   that API logs `schedulers_disabled` while MCP logs `schedulers_started` — **exactly one process
   must own the schedulers**.
2. **Implement G6.4 rate limits** — register 30/min/IP, login 60/min/IP, Redis counter pattern as in
   `app/listings/router.py` upload limiter; diagnosis stays per-user. 429 carries a localized key.
3. **Burst test** (G6.3) from the VPS, then full regression smoke (G6.5).
4. **T5 rotation, last.** Generate a strong password, store only in `.env.spices`, change via the
   API, replace the literal in `e2e-v3/test-all.js` (and any other grep hit) with
   `process.env.GOVIHUB_ADMIN_PW`, re-run a 5-endpoint admin smoke. Old value stays in git history
   but is dead once rotated.
5. **T7** needs AWS credentials from Nuwan.

## Rollback

- T4: redeploy previous umbrella image.
- T8: no rollback needed; migration 015 is additive. Reverting app code leaves the columns harmless.
- T6: revert the compose change, `up -d --force-recreate govihub-api-spices`. Snapshot:
  `/root/backups/spices-pre-moderation-20260824-003725.sql`.
