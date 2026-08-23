# INTL_PHONE_SUPPLIER_VERIFICATION.md

**Feature:** International phone country picker + supplier marketplace detail fix + listing photos
**Branch:** `spices` · **Date:** 2026-08-23 · **Target:** `spices.govihublk.com`
**Spec:** `CC_INTL_PHONE_SUPPLIER_FIX.md` · **Audit:** [`INTL_PHONE_SUPPLIER_AUDIT.md`](INTL_PHONE_SUPPLIER_AUDIT.md)

---

## 1. GATE 0 (summary — full table in the audit doc)

| Item | Actual | Root cause |
|---|---|---|
| Intl phone blocked at | **Nowhere** — frontend had a full-country dropdown, backend/DB generic E.164; +86/+1 farmers already in prod | Missing product control (curated list), not a block |
| Listing card click | No handler, no detail view; farmer card rendered **`tel:undefined`** | UI written against an imagined API; detail endpoint returned only `supplier_id` |
| Supplier phone in API | Neither list nor detail | Detail never joined `users` |
| Photos column | **`images` JSONB already existed** | No migration needed — spec's 3.1 dropped |
| R2 | All 5 vars set | — |
| Suppliers NULL phone | 0 of 31 | — |

**No migration ran this deploy. Alembic head remains `014`. Table count unchanged.**

## 2. What shipped

| Commit | Change |
|---|---|
| `5831f26` | Curated phone country list (spec's 35 markets) inside shared `PhoneInput` — all 6 entry points inherit |
| `1b58d2d` | Marketplace backend: supplier block in detail, names+thumbnails in list, scoped image endpoints, `StorageService.delete_image` |
| `45f1a9f` | 9 locale keys EN/SI/TA (`marketplace.*` + `auth.select_country`) |
| `16273db` | Frontend: clickable cards → `SupplyListingDetailModal` (tel:/wa.me), photo create/edit via scoped endpoints, hydration + null-crash fixes |
| `e57e76d` | LK pinned first in dropdown (`countryOptionsOrder`) — caught by Playwright P1 |



**Deviations from spec, all recorded in the audit doc:** migration 3.1 unnecessary (D3); shared
component amended instead of new `GoviPhoneInput` (D4); locales at `src/messages/` (D2); login route
`/auth/beta/login` (D1); oversize/bad-type reject **422** (codebase `ValidationError` convention)
instead of the spec's 400 — `LISTING_PHOTO_LIMIT` is 400 as specced.

## 3. Local verification (before deploy)

15/15 against the live local API: create 201 · upload×2 → photos len 2 · non-owner 403 · 6MB 422 ·
gif 422 · 4th photo **400 LISTING_PHOTO_LIMIT** (correct envelope) · list has supplier_name +
thumbnail + **no phone anywhere in the item JSON** · detail has supplier.phone/district/member_since ·
unauth 401 · delete → len 1 · non-owner delete 403. `tsc --noEmit`: zero non-test errors.

## 4. Prod deploy record

- **Snapshot:** `/root/backups/spices-pre-intlphone-mkt-20260823-061217.sql` (5,991,891 bytes)
- Build `--no-cache` api+web: **0 errors**; containers recreated on fresh images (06:14/06:15 UTC)
- Second web-only `--no-cache` build for the LK-first fix (§6)
- MCP container, Gunicorn worker count, Traefik: untouched

### S1–S13 smoke (prod, real tokens, via public edge) — **15/15**

```
S1   register buyer +52 (Mexico)        200 + login 200
S2   register farmer +94 (regression)   200
S3   phone "12345"                      422
S4   list: supplier_name + thumbnail, NO phone   OK
S5   detail: supplier.phone E.164       +94774667625
S6   detail unauth                      401
S7   upload 2 photos                    200 len 2; URL serves image/png 200
S8   other supplier upload              403
S9   6MB                                422
S10  gif                                422
S11  4th photo                          400 LISTING_PHOTO_LIMIT
S12  delete image                       200 len 1
S13  PUT /users/me phone → +9715…       200, persisted on GET /users/me
```

## 5. Playwright P1–P7 (prod, real UI navigation) — **8/8 PASS**

Test file `e2e-v3/test-intl-mkt.js` · results `e2e-v3/results/intl-mkt-consolidated-2026-08-23.json`
· 23 screenshots in `e2e-v3/screenshots/intl-mkt/`

| Test | Evidence |
|---|---|
| P1 buyer reg, Mexico picker | Curated 35 entries; Nigeria/Russia/"International" **absent**; +52 accepted → buyer dashboard |
| P2 farmer reg, LK default | LK flag untouched → farmer dashboard |
| P3 desktop + mobile | Card click → modal: supplier name, Kandy, +94774667625, `tel:+94…`, `https://wa.me/94…` |
| P4 buyer click-through | Same modal + links |
| P5 create listing + 2 photos | Thumbnails on My Listings and farmer marketplace; detail renders both (naturalWidth>0) |
| P6 edit photos | Remove 1 + add 1 → reload → persisted |
| P7 settings → UAE via picker | +971 50 894 2015 persisted, AE flag |

**Finding from P1, fixed same session:** LK was the preselected default but **not row 1** of the
dropdown (library sorts alphabetically — Australia was first). Locked decision says "LK default and
first" → `countryOptionsOrder={["LK","|"]}` pins it, verified after redeploy (§6).

## 6. LK-first re-verification — CONFIRMED LIVE

Web-only `--no-cache` rebuild (0 errors), container recreated, post-deploy URLs all 200
(`/api/v1/health`, `/en/auth/beta-login`, `/en/terms`, `/`).

Live browser check against the prod register tab (real DOM, not assumed):

```json
{"found":true, "first3":["LK","|","AU"], "count":36, "hasIntl":false, "selected":"LK"}
```

Sri Lanka pinned first, divider, then alphabetical; 35 countries + divider = 36 options;
no "International" entry; LK preselected. Locked decision "LK default and first" fully satisfied.

## 7. DB verification (5.3)

```
fixture listing photos after S12:   1   (matches API)
P5 listing photos after P6:         2   (matches UI)
ck_users_ck_users_phone_e164:       generic ^\+[1-9][0-9]{1,14}$, admin-exempt
non-E.164 phones (non-admin):       0
```

## 8. Cleanup (5.4) — done, verified

R2 objects removed **via the authenticated DELETE endpoint** (owners still existed): 3 photo deletes,
all 200 — fixture 1, P5 listing 2. Then FK-safe SQL (dry-run with ROLLBACK first, then COMMIT):

- 7 test users deleted: `auditprobe0823` (GATE 0 probe), `smkbuy/smkfrm/smksup/smksup2 466762`
  (smoke), `plwmkt833945f`, `plwmkt358322b` (Playwright)
- 2 test listings deleted; 3 role profiles; refresh tokens etc. via the 23-FK-reference list
- **Counts restored exactly: users 209 → 202, supply_listings 9 → 7, test rows remaining 0**

## 9. Definition of Done — status

- [x] GATE 0 table with root causes
- [x] Country picker live on all entry points, LK default (+first after §6 fix), whitelist = `phoneCountries.ts`
- [x] Mexican registration E2E (S1, P1) · [x] LK regression (S2, P2)
- [x] Backend validator + DB constraint generic E.164 (were already; verified)
- [x] Card click → detail with supplier name/district/phone, tel: + wa.me, farmer + buyer
- [x] Phone absent from list, present in detail, 401 unauth
- [x] Photo rules enforced (S7–S12) — via existing `images` column, no migration
- [x] Thumbnails + placeholder + detail photos
- [x] EN/SI/TA keys; SI flagged for Aruni (TA still has no reviewer)
- [x] All curl + Playwright pass, screenshots recorded
- [x] DB verification clean, test data cleaned
- [x] API contract updated: `docs/api/marketplace.md`
- [x] Final report: this document

## 10. Deferred / carried forward

- SMS OTP, SI/TA country names in picker, AI photo moderation (→ CC_LISTING_MODERATION), supplier
  business profiles, inquiry rework — all out of scope per spec.
- `app/admin/schemas.py:94` admin phone field lacks E.164 validation (found in passing).
- Generic `POST /uploads/image` has no per-resource binding or count cap (pre-existing; harvest
  listings use it) — flag for the moderation spec.
- Known 500 on duplicate phone+role registration (`uq_users_phone_role` leaks IntegrityError) —
  pre-existing, unchanged.
- **Plaintext prod admin credential in `e2e-v3/test-all.js:20` — still open since July, still the
  top security item.**

## 11. Rollback

No migration to revert. Backend/frontend: redeploy previous images with `--no-cache`. Snapshot
available at `/root/backups/spices-pre-intlphone-mkt-20260823-061217.sql`.
