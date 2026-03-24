# REPORT 05 — Listings Module

**Date:** 2026-03-23
**Prompt:** 05 — Listings Module (HarvestListing + DemandPosting CRUD)

---

## Files Created / Modified

| File | Action |
|---|---|
| `govihub-api/app/listings/schemas.py` | Created |
| `govihub-api/app/listings/service.py` | Created |
| `govihub-api/app/listings/router.py` | Replaced (kept crop/district endpoints, added all new endpoints) |
| `govihub-api/app/utils/storage.py` | Already existed from earlier prompt — no change required |
| `govihub-api/app/main.py` | Updated router tag comment; tag changed from "Reference Data" to "Listings" |

---

## 1. Schemas (`app/listings/schemas.py`)

### Harvest Listing
| Schema | Purpose |
|---|---|
| `HarvestListingCreate` | POST body; validates lat/lng pair, date order, delivery radius requirement |
| `HarvestListingUpdate` | PUT body; all fields optional, excludes none on serialize |
| `HarvestListingRead` | Full detail response; includes derived `latitude`/`longitude` from PostGIS WKB |
| `HarvestListingBrief` | Compact summary (list views) |
| `HarvestStatusUpdate` | PATCH /status body |
| `HarvestListingFilter` | Browse query parameters (geo + price + organic filters) |

### Demand Posting
| Schema | Purpose |
|---|---|
| `DemandPostingCreate` | POST body; validates lat/lng pair, recurrence_pattern requirement |
| `DemandPostingUpdate` | PUT body; all fields optional |
| `DemandPostingRead` | Full detail response |
| `DemandStatusUpdate` | PATCH /status body |
| `DemandPostingFilter` | Browse query parameters |

`CropBrief` schema is used nested inside both Read responses.

---

## 2. Service (`app/listings/service.py`)

### `ListingService` methods

**Harvest:**
- `create_harvest(farmer_id, data)` — inserts listing, then updates location column via raw SQL `ST_SetSRID(ST_MakePoint(lng, lat), 4326)`
- `get_harvest(listing_id)` — selectinload crop relationship; raises 404
- `list_my_harvests(farmer_id, status, crop_id, page, size)` — farmer's own listings with optional status/crop filter
- `list_all_harvests(filters, page, size)` — public browse; applies PostGIS `ST_DWithin` for geo radius filter
- `update_harvest(listing_id, farmer_id, data)` — owner check + status guard (draft/active only)
- `update_harvest_status(listing_id, farmer_id, new_status)` — validates transition against `HARVEST_TRANSITIONS` map
- `delete_harvest(listing_id, farmer_id)` — hard delete only for draft; non-draft must be cancelled via status update

**Demand:**
- `create_demand`, `get_demand`, `list_my_demands`, `list_all_demands`, `update_demand`, `update_demand_status`, `delete_demand` — same pattern as harvest counterparts

### Status Transition Maps

**Harvest (`ListingStatus`):**
```
draft   → active | cancelled
active  → matched | sold | expired | cancelled
matched → sold | active | cancelled
sold    → (terminal)
expired → (terminal)
cancelled → (terminal)
```

**Demand (`DemandStatus`):**
```
draft   → active | cancelled
active  → matched | fulfilled | expired | cancelled
matched → fulfilled | active | cancelled
fulfilled → (terminal)
expired → (terminal)
cancelled → (terminal)
```

---

## 3. Router (`app/listings/router.py`)

All endpoints are prefixed with `/api/v1` (from main.py include).

### Reference Data (retained)
| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/crops` | Public |
| GET | `/api/v1/crops/{crop_id}` | Public |
| GET | `/api/v1/districts` | Public |

### Image Upload
| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/uploads/image` | Any active user |

### Harvest Listings
| Method | Path | Role |
|---|---|---|
| POST | `/api/v1/listings/harvest` | farmer |
| GET | `/api/v1/listings/harvest` | farmer (own list) |
| GET | `/api/v1/listings/harvest/browse` | Any active user |
| GET | `/api/v1/listings/harvest/{listing_id}` | Any active user |
| PUT | `/api/v1/listings/harvest/{listing_id}` | farmer (owner) |
| PATCH | `/api/v1/listings/harvest/{listing_id}/status` | farmer (owner) |
| DELETE | `/api/v1/listings/harvest/{listing_id}` | farmer (owner) |

### Demand Postings
| Method | Path | Role |
|---|---|---|
| POST | `/api/v1/listings/demand` | buyer |
| GET | `/api/v1/listings/demand` | buyer (own list) |
| GET | `/api/v1/listings/demand/browse` | Any active user |
| GET | `/api/v1/listings/demand/{posting_id}` | Any active user |
| PUT | `/api/v1/listings/demand/{posting_id}` | buyer (owner) |
| PATCH | `/api/v1/listings/demand/{posting_id}/status` | buyer (owner) |
| DELETE | `/api/v1/listings/demand/{posting_id}` | buyer (owner) |

**Note:** `/browse` routes are registered BEFORE `/{id}` routes to prevent path parameter shadowing.

---

## 4. Storage Service (`app/utils/storage.py`)

Already existed from a prior prompt with the following capabilities:
- `upload_image(file_bytes, content_type, folder, filename)` — validates MIME (JPEG/PNG) and file size (≤10 MB)
- Uploads to Cloudflare R2 if credentials configured; falls back to `/app/uploads/` on local disk
- `StorageService` singleton at `storage_service`
- The router calls `storage_service.upload_image()` with `content_type` from the `UploadFile` object

---

## 5. Main App (`app/main.py`)

- Router tag updated from `"Reference Data"` to `"Listings"` to reflect expanded scope
- The same `listings_router` instance handles both reference data routes and listings CRUD under `prefix="/api/v1"`

---

## Design Decisions

1. **Geo storage**: Location stored as PostGIS `Geography("POINT", srid=4326)`. All inserts/updates use raw SQL `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` to avoid ORM/GeoAlchemy2 serialization issues. Reads extract lat/lng via `geoalchemy2.shape.to_shape()`.

2. **lat/lng in schemas**: The ORM `location` column holds WKB geography. Schemas use separate `latitude`/`longitude` float fields for input/output. The conversion is handled in `_harvest_to_read()` and `_demand_to_read()` helper functions in the router.

3. **Browse vs My-Listings**: `/browse` returns active listings for any authenticated user (farmer viewing demands, buyer viewing harvests). `/listings/harvest` (GET) returns only the current farmer's own listings of any status.

4. **Delete semantics**: Only `draft` status listings/postings can be hard-deleted. Active or matched listings must be transitioned to `cancelled` via the status endpoint, preserving audit history.

5. **ST_DWithin**: Geo filter uses `ST_DWithin(geography, geography, meters)` via `sqlalchemy text()` with bound parameters — works correctly with PostGIS geography type (uses spherical distance, not planar).

---

## Syntax Validation

All files passed `ast.parse()` syntax check before completion.
