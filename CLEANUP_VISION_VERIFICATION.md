# CLEANUP_VISION_VERIFICATION.md

**Loop:** T1 duplicate-registration 500 · T2 admin phone validation · T3 upload binding · T4 Vision & Mission
**Branch:** `spices` · **Date:** 2026-08-23 · **Targets:** `spices.govihublk.com` + `govihublk.com`
**Spec:** `CC_CLEANUP_LOOP_AND_VISION.md` · **State:** `/opt/govihub-spices/.cc_state/cleanup_vision_loop.json`

**All four tasks `passed`. Prod gates 19/19. Baseline restored exactly.**

| Commit | Scope |
|---|---|
| `c452ed9` | T1/T2/T3 backend |
| `b27eca7` | T4 Vision & Mission both sites + T1 frontend/i18n + review queues |

Snapshot before deploy: `/root/backups/spices-pre-cleanuploop-20260823-170959.sql` (6,014,489 bytes).
No migration ran. Alembic head unchanged at `014`.

---

## T1 — duplicate registration 500 → clean 409

### Root cause (reproduced live before any code)

Registering a second account with the same phone **and** the same role raised
`asyncpg.UniqueViolationError` on `uq_users_phone_role`, surfacing as
`sqlalchemy.exc.IntegrityError` at `beta_router.py:102` (the `flush`) with no handler → **500 +
traceback**. The sibling paths were **already correct** and were left alone:

| Path | Before | Verdict |
|---|---|---|
| duplicate phone + same role | **500** | the bug |
| duplicate username | 409 `USERNAME_TAKEN` | already clean |
| duplicate email + same role | 409 `ROLE_ACCOUNT_EXISTS` | already clean |
| duplicate phone, **different** role | 200 | **correct — the constraint is `(phone, role)`; preserved** |

### Fix
Pre-check returning `409 {"code": "DUPLICATE_PHONE"}`, plus an `IntegrityError` catch as a safety
net for the concurrent-signup race (two identical signups in flight). The catch maps the constraint
name to `DUPLICATE_PHONE` / `USERNAME_TAKEN` / `DUPLICATE_EMAIL` and re-raises anything unrecognised
rather than swallowing it. Frontend renders the message inline beside the offending field via the
existing field-error mechanism; **form state is preserved**.

### Gates
```
G1.1 dup phone      -> 409 DUPLICATE_PHONE
G1.2 dup username   -> 409 USERNAME_TAKEN
G1.3 dup email      -> 409 ROLE_ACCOUNT_EXISTS
G1.4 Playwright UI  -> exact localized string, inline 39px below the phone input (not just a
                       banner), no crash, form still holds username/name/district
G1.5 api logs       -> zero tracebacks across the gate run
regression          -> same phone on a different role still 200
```

**Deviation:** `ROLE_ACCOUNT_EXISTS` was deliberately **not** repointed to the new
`email_already_registered` string on the beta form — that form signs up with a *username*, so
"This email is already registered" would be wrong there. It keeps its actionable "switch roles in
Settings" copy. The new email string is wired into the OAuth wizard, where the identity really is an
email, so the key is used rather than dead.

## T2 — admin schemas: E.164 validation

`AdminUserUpdate.phone` was `Field(None, max_length=20)` with **no validator**, so the admin panel
accepted `abc` and `0771234567`. The DB CHECK only guards non-admin rows, so bad values could land.

Fix: the shared optional E.164 validator on the schema (format, any role), and the **role** rule in
`AdminService.update_user` — clearing a non-admin's phone now returns a reason instead of tripping
the DB CHECK into another 500. Admin-role users may still have no phone.

```
G2.1 "0771234567" -> 422      G2.4 clear ADMIN phone  -> 200 allowed
G2.2 "abc"        -> 422      G2.5 clear farmer phone -> 422 rejected
G2.3 "+94…" valid -> 200, persisted (GET confirms)
G2.6 admin panel UI            -> see "not verified" below
```

### ⚠️ Incident during G2.4 — caused and corrected

G2.4 clears the acting admin's own phone. My gate script then tried to restore the prior value and
**did not check the response status**. The restore was rejected — by the very validator this task
shipped — because the stored value `0771234567` is not valid E.164. Net effect: admin `nuwan` was
left with an empty phone, and the script reported success.

Caught by querying the DB rather than trusting the script's output. Restored via targeted SQL
(`WHERE username='nuwan' AND role='admin'`) to the exact pre-loop value `0771234567`; verified
`admins_with_phone = 1` after cleanup. The other five admin accounts were already empty before this
loop (confirmed in the pre-work audit) and were never touched.

**Follow-up for Nuwan (not actioned — real user data):** `nuwan`'s stored phone is in local format
and is now unrepresentable through the admin UI, which requires E.164. The same number normalized is
`+94771234567`. Normalizing it is a one-line update, but it changes real account data, so it needs
your say-so.

## T3 — `/uploads/image` binding

### Caller map (mandatory audit output)

| Caller | Flow | Role | Writes | Scoped alternative? |
|---|---|---|---|---|
| `govihub-api/app/listings/router.py:131` | the route itself | `require_complete_profile` | `{folder}/{uuid}.{ext}` | — |
| `govihub-web/.../farmer/listings/page.tsx:139` | harvest listing create/edit | farmer | `?folder=harvests` | none — pre-resource upload |
| diagnosis | crop diagnosis | farmer | calls `storage_service` **directly** | n/a — never uses this HTTP route |
| ads | admin ad images | admin | calls `storage_service` **directly** | n/a |
| marketplace photos | supply listings | supplier | **already scoped** (`/marketplace/listings/{id}/images`, shipped previous deploy) | yes |

**What an authenticated user could do before:** the `folder` query param was free-form and
client-supplied, with no per-user prefix — any complete-profile user could write arbitrary
JPEG/PNG/WebP under **any prefix in the bucket**, unattributable to them. Type and size were
enforced (via `storage_service`), so it was not unbounded file hosting, but it was unbound
*placement* and unbound *ownership*.

### Option chosen: **B (bind)** — with reasoning

Option A (delete the route) needs every caller on a scoped endpoint. There is exactly one caller,
and it is a genuine **pre-resource** upload: the harvest form collects photos before the listing
exists, so there is no resource id to key on. That is the precise case the spec sanctions for
Option B. Option A would have meant restructuring a live farmer flow (create-then-upload) for
marginal gain over a properly bound endpoint — real regression risk on a Tier-2 system with live
users, for no additional security.

Implemented: `purpose` allowlist (`harvests`, `demands`) replacing the free-form folder; key
`{purpose}/{user_id}/{uuid}.{ext}`; existing JPEG/PNG/WebP + size caps retained; **60/hour per-user
Redis cap** (same counter pattern as the admin AI query) that **fails open** if Redis is down so an
outage cannot block farmers uploading; and **attach-time validation** — creating or updating a
harvest listing rejects any image URL bound to a different user. Legacy flat keys (uploaded before
this binding) are still accepted so already-published listings keep their photos. The deprecated
`?folder` alias is kept so already-loaded browser bundles keep working.

```
G3.1 unauth upload            -> 401
G3.2 purpose=evil             -> 422
G3.3 purpose=harvests         -> 200, key harvests/{user_id}/…
G3.4 legacy ?folder alias     -> 200
G3.5 attach foreign image     -> 422   |  own image -> 201  |  legacy flat -> 201
G3.3-G3.5 regressions         -> diagnosis, ads, marketplace uploads untouched (separate code paths,
                                  verified by the caller map; marketplace re-verified last deploy)
```

**Self-correction:** the first attach-time implementation was **inverted** — it accepted foreign
keys and rejected legacy ones. Caught because the test asserted all three cases (foreign / own /
legacy) rather than only the happy path. Rewritten to parse the segment after the purpose marker
explicitly. Attempt 2 of 3.

## T4 — Vision & Mission on both front pages

Canonical July 2026 text, **byte-for-byte**, Sinhala first and English below, on the umbrella
`index.html` + `si.html` and the spices landing (`en`/`si`/`ta`). Spices uses a locale-independent
constant (`govihub-web/src/lib/visionMission.ts`), not translation keys, so all three locales show
the identical block. Umbrella uses one generated markup block pasted identically into both files
between `<!-- CANONICAL VISION/MISSION -->` markers — `md5` of the extracted region matches across
the two files. Design: `#E8A838` accent bar, `#2D6A2E` subheads, ~70ch measure, mobile-first, no brown.

```
G4.4 byte-identity: 4/4 strings ZERO DIFF vs .cc_state/vision_canonical.txt on all three
     sources, U+200D ZWJ preserved, no HTML-entity escaping needed
G4.1 https://govihublk.com/            200, both markers
G4.2 https://govihublk.com/si          200, both markers
G4.3 spices /en, /si, /ta              200, both markers — SSR-present (not client-rendered)
G4.5 13 screenshots: e2e-v3/screenshots/cleanup-vision/
     umbrella EN+SI at 1280x800 and 360x640, spices en+si at 390x844, plus element shots
```
`/about` and `/contact` confirmed unchanged (section is front-page only, as specced).

### Font finding — investigated, not assumed

The umbrella loads **no webfont at all**: `styles.css` lists `"Noto Sans Sinhala"` in the body stack
and relies on the visitor's OS. The spices app loads it from Google Fonts. Since the Vision block
puts prominent Sinhala on the **English** homepage for the first time, this was worth resolving
rather than waving through.

Verdict: **real Sinhala glyphs on all four pages**, established via CDP
`CSS.getPlatformFontsForNode` (the family that actually rasterised), `document.fonts.check()`,
canvas glyph-distinctness hashing against tofu codepoints, and a ZWJ-conjunct shaping width test.

The umbrella pass is partly an artifact of the test host, which has Noto Sans Sinhala installed
per-user. A **control** run — stripping Noto from the stack at runtime — fell back to Windows'
bundled *Iskoola Pota* and still rendered real glyphs. So: browsers do last-resort per-script
fallback, and every mainstream OS a Sri Lankan visitor uses ships a Sinhala face (Windows Nirmala
UI/Iskoola Pota, Android Noto Sans Sinhala, iOS Sinhala Sangam MN).

**Conclusion: a robustness and typographic-control gap, not a live tofu bug.** Tofu would need an OS
with zero Sinhala coverage, which could not be tested here and so cannot be ruled out. Adding the
same Google Fonts link the spices app uses would close it — **not done**, because it introduces an
external dependency the umbrella does not currently have anywhere, and that is a call for Nuwan.

## Review queues

- **`SINHALA_REVIEW_PENDING.md` → Dilsha Gunarathna** (not Aruni, per the July 2026 handover):
  the 3 new error strings from this loop plus the 9 still-unreviewed keys from the previous deploy.
- **`TAMIL_REVIEW_PENDING.md` → no reviewer assigned yet**: same 12 strings plus a corrected inventory.

### Correction to the spec's Tamil figure — measured, not repeated

The spec cites "~198 of 247 placeholders, 23 missing auth keys". Actual measurement: `en.json` has
**620** keys, `ta.json` has **271**; 198 are `[TA]` placeholders **and a further 349 keys are absent
entirely**. So **547 of 620 strings have no usable Tamil**, and the auth shortfall is **33** (16
missing + 17 placeholders), not 23. Worth resizing the upcoming Tamil spec around the real number.

One Tamil term was escalated rather than guessed: Gemini proposed **வகிபாகம்** for "role" where
`ta.json` already uses **வகைப் பாத்திரம்**. The existing term was kept for consistency and the
choice flagged for the reviewer.

## Deploy, gates, cleanup

Both stacks built `--no-cache` and recreated (never `up -d --build`): spices api+web, and the
umbrella image. **Prod gates: 19/19 passed** (G1.1–G1.3, G2.1–G2.5, G3.1–G3.4, G4.1–G4.3), plus
G1.4 and G4.5 via Playwright.

**Cleanup** — R2 first (two orphaned test objects under `harvests/{user_id}/`, deleted by prefix
sweep), then FK-safe SQL with a dry run before commit:

```
users     210 -> 203   (baseline 203 restored exactly)
listings    7 ->   7   (untouched)
loop test users left:  0
admins_with_phone:     1   (nuwan restored)
R2 objects deleted:    2
```

## Not verified / carried forward

- **G2.6 (admin panel UI edit)** — not exercised. G2.1–G2.5 verify the same validation at the API
  the panel calls, but the panel's own form was not driven. Stated rather than implied.
- **Umbrella webfont** — decision pending (above).
- **Admin phone normalization** for `nuwan` — decision pending (above).
- **Plaintext production admin credential in `e2e-v3/test-all.js:20`** — unchanged, still the top
  security item. This loop *used* that credential for the T2 gates (passed via env var, never
  committed), which is precisely why rotation matters.
- Deferred by the manager and untouched: admin password rotation, Tamil implementation pass,
  moderation spec, umbrella privacy PDPA corrections.

## Rollback

No migration. Redeploy the previous images `--no-cache` for either stack. DB snapshot above.
