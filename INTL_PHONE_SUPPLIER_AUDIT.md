# INTL_PHONE_SUPPLIER_AUDIT.md — GATE 0

**Date:** 2026-08-23 · **Branch:** `spices` (local = origin = `884bff3`) · **Target:** spices prod
**Method:** live prod DB queries + live API probes (real registered token) + full repo sweep.
**Spec:** `CC_INTL_PHONE_SUPPLIER_FIX.md`

---

## GATE 0 findings table

| Item | Reported | Actual (from audit) | Root cause |
|---|---|---|---|
| International phone blocked at | ? | **Not blocked anywhere.** Frontend `PhoneInput.tsx` already wraps `react-phone-number-input` with a **full country dropdown** (`defaultCountry="LK"` is a default, not a restriction). Backend validator is generic E.164 (`app/users/phone.py:9`). DB constraint `ck_users_ck_users_phone_e164` is generic, admin-exempt (verified live). **Real farmers with `+86` and `+1` numbers already exist in prod.** | Nothing blocks international. The missing piece is the **product control**: a curated whitelist of spice-export markets instead of all ~240 countries. The work is *restricting*, not enabling. |
| Listing card click | broken | **No click handler, no detail view anywhere in the marketplace UI.** Worse: the farmer card renders `<a href={"tel:" + supplier.phone}>` where `supplier.phone` is a field **the API has never returned** → `tel:undefined`. Buyer card renders `product.rating`, `product.supplier`, `product.availability` — all absent from the API. | The card UI was written against an **imagined API contract** and the detail view was never built. `ListingDetailsModal` exists but is used only by matches pages. |
| Supplier phone in API | missing | **Neither list nor detail.** Both share one schema `SupplyListingRead` (`marketplace/schemas.py:92-112`) — only `supplier_id`. Verified live: detail = 200 auth'd with no supplier info, 401 unauth. A `SupplierBrief` schema exists at `schemas.py:21-26` **but is unused** — someone started this and stopped. | Detail endpoint never joins `users`. |
| Supply listings photos column | absent? | **Column exists: `images` JSONB (nullable)** — verified in live DB and `marketplace/models.py:48`. Write path stores `{"urls": [...]}` (`service.py:39-50`); API returns the raw dict; all 7 prod listings have `images: null`. Supplier create form **already has photo-upload UI** posting to the generic `POST /uploads/image?folder=supply`. Edit-page hydration expects `photos`/`images` as *arrays* so existing photos never rehydrate. | **No migration needed.** Gaps are: no per-listing endpoints with ownership/limit/type/size rules, read↔write shape mismatch, and the hydration bug. |
| R2 configured | yes | **Yes** — all 5 `R2_*` vars set in `/opt/govihub-spices/.env.spices`. Existing utility `app/utils/storage.py` (`StorageService.upload_image`, R2 via boto3, public-URL discovery, local fallback). | — |
| Suppliers with NULL phone | 0 | **0** of 31 suppliers (live query). | Mandatory-phone gate working; includes suppliers. |

Prod context since last deploy: users 116 → **202**, supply listings **7** (real, e.g. "Whole pepper", created 2026-08-03). The field report is fully explained: a supplier lists produce, a buyer taps the card, nothing opens, and the only phone link ever rendered is `tel:undefined`.

## Deviations from spec (resolved here, per STEP 0 instruction)

| # | Spec says | Actual | Resolution |
|---|---|---|---|
| D1 | `POST $API/auth/login` in probe scripts | Route is **`/auth/beta/login`** | Use real route in all tests |
| D2 | Locales at `locales/{en,si,ta}.json` | **`govihub-web/src/messages/{en,si,ta}.json`**, nested-namespace convention | Use real path/convention |
| D3 | Migration 3.1 adds `photos` JSONB | **`images` JSONB already exists**; only unused-in-prod data shape `{"urls":[...]}` | **No migration.** Keep the column; API exposes computed `photos: list[str]` + `thumbnail`; storage keeps `{"urls":[...]}` shape consistently. Spec principle "storage format stays" honored. |
| D4 | Create new `GoviPhoneInput` + replace field at 3 places | A shared `PhoneInput.tsx` **already wraps react-phone-number-input and is used by all 6 phone entry sites** (register, beta-login, complete-profile, 3× settings) | Apply `countries={PHONE_COUNTRIES}`, `addInternationalOption={false}`, `countryCallingCodeEditable={false}` **inside the shared component**. One file + the new list file; every entry point inherits. Zero call-site churn. |
| D5 | List endpoint = `GET /marketplace/listings` | Frontend actually calls **`GET /marketplace/search`**; `/listings` also exists (both `require_complete_profile`) | Enrich the shared `SupplyListingRead` schema → both routes gain the fields. Frontend keeps `search` for list, calls `/listings/{id}` for detail. |
| D6 | "Settings profile page" (one) | **Three** settings pages (farmer/buyer/supplier) | Covered automatically by D4. |
| D7 | Photo upload via new scoped endpoints | Supplier form uploads via generic `/uploads/image` (no ownership binding, no count limit, 10MB client cap) | Build the scoped endpoints per locked decision 5; switch the supply flow to them. The generic endpoint stays (harvest-listing photos use it) — out of scope. |

## Found in passing (NOT fixed — logged only)

1. `app/admin/schemas.py:94` — admin user phone field has **no E.164 validator** (DB constraint exempts admins, so bad values can enter admin rows; the live `077...` admin row proves it).
2. `farmer/marketplace/page.tsx:65` — `s.description.toLowerCase()` throws on null description; buyer page `product.price.toLocaleString()` throws on null price. **These two get fixed incidentally** because the cards are being rewritten against the real contract — noted so the diff is understood.
3. The generic `POST /uploads/image` (auth `require_complete_profile`) lets any complete-profile user upload arbitrary images to R2 with no per-resource binding or count cap — pre-existing, used by harvest listings; flag for the moderation spec.
4. `e2e_*` harness accounts from `e2e-v3/test-all.js` do **not** exist in prod (login 401) — the plaintext-credential issue from July is unchanged, still open.

## Decisions (reversible, made now, per autonomy charter)

- **DECISION:** whitelist enforcement lives in the UI list only (locked decision 3 confirms); backend/DB stay generic — a +52 Mexican buyer already passes today, and S1 will prove it.
- **DECISION:** canonical photo storage = existing `images` column, `{"urls":[...]}` shape; API surface speaks `photos`/`thumbnail`. No data migration for 7 null rows.
- **DECISION:** the spec's separate `GoviPhoneInput` is not created; the existing shared component is amended (D4). Spec intent (curated picker everywhere, LK default) fully preserved.
- **DECISION:** this audit doc + the spec's own step/test structure serve as the written plan; a third planning artifact would duplicate the spec verbatim.

**GATE 0: PASSED — proceeding to implementation with the resolutions above.**
