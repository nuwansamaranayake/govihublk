# API Contract — Supply Marketplace

**Updated:** 2026-08-23 (CC_INTL_PHONE_SUPPLIER_FIX) · Base: `/api/v1/marketplace`
All routes require auth (`require_complete_profile` or `require_role`). Verified against local
15/15 suite before deploy; prod smoke S1–S13 in `INTL_PHONE_SUPPLIER_VERIFICATION.md`.

| Frontend call | Backend endpoint | Auth | Status |
|---|---|---|---|
| Marketplace browse (farmer/buyer pages) | `GET /marketplace/search` | complete profile | **changed** — items gain `supplier_name`, `supplier_district`, `photos[]`, `thumbnail` |
| Marketplace browse (paged) | `GET /marketplace/listings` | complete profile | **changed** — same enrichment |
| Listing detail (SupplyListingDetailModal) | `GET /marketplace/listings/{id}` | complete profile | **changed** — now returns `supplier {id, name, phone, district, member_since}` |
| Create listing (supplier form) | `POST /marketplace/listings` | supplier/admin | unchanged |
| My listings | `GET /marketplace/listings/mine` | supplier/admin | unchanged |
| Update listing | `PUT /marketplace/listings/{id}` | supplier/admin (owner) | unchanged |
| Upload listing photos | `POST /marketplace/listings/{id}/images` (multipart `files`, 1–3) | supplier/admin, **owner-or-admin** | **new** |
| Delete listing photo | `DELETE /marketplace/listings/{id}/images` (JSON `{url}`) | supplier/admin, **owner-or-admin** | **new** |

## Contract notes

- **Supplier phone appears ONLY in the detail response** (`supplier.phone`), never in list/search
  items — deliberate bulk-scrape control. Detail is behind auth (401 unauth, verified).
- **Photos:** storage keeps the legacy `images = {"urls": [...]}` JSONB shape (no migration);
  the API surface speaks `photos: string[]` and `thumbnail: string|null` (= `photos[0]`).
  Clients must ignore the raw `images` field.
- **Image rules:** JPEG/PNG/WebP · ≤ 5 MB per file · ≤ 3 photos per listing.
  Over-limit → **400** `{"error":{"code":"LISTING_PHOTO_LIMIT"}}`.
  Bad type / oversize → **422** (codebase `ValidationError` convention; spec said 400 — recorded
  deviation). Non-owner → **403**. R2 key: `marketplace/{listing_id}/{uuid}.{ext}`; object delete
  is best-effort, the DB row is the source of truth.
- **Phone:** backend validator and DB CHECK are **generic E.164** (`^\+[1-9]\d{1,14}$`,
  admin-exempt). The curated country list lives in the frontend only
  (`govihub-web/src/lib/phoneCountries.ts`) — the UI list is the product control; the server
  accepts any valid E.164 so list changes can never lock out an existing user.
