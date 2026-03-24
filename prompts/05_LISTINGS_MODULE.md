# Prompt 05 — Listings Module (Harvest & Demand CRUD)

## Context
Users can register and have role-specific profiles. Now build the core business entities: harvest listings (farmer) and demand postings (buyer).

## Objective
Full CRUD for harvest listings and demand postings, including status lifecycle management, photo handling, and filtered listing queries with geospatial support.

## Instructions

### 1. app/listings/schemas.py

**Harvest Listings**:
- `HarvestListingCreate`: crop_id (UUID), quantity_kg, quality_notes (opt), available_from (date), available_to (date), pickup_latitude, pickup_longitude, pickup_address (opt), is_ready_now (bool, default False), photos (list of str — R2 URLs, opt)
- `HarvestListingUpdate`: All fields optional
- `HarvestListingRead`: All fields + id, farmer_id, status, crop (nested CropTaxonomyBrief), farmer_name, farmer_district, created_at, updated_at
- `HarvestListingBrief`: id, crop_name_si, crop_name_en, quantity_kg, status, available_from, pickup_address, is_ready_now
- `HarvestStatusUpdate`: status (enum of valid transitions)
- `HarvestListingFilter`: crop_id (opt), status (opt), district (opt), is_ready_now (opt), available_from (opt), available_to (opt), min_quantity (opt), max_quantity (opt), page, size

**Demand Postings**:
- `DemandPostingCreate`: crop_id, quantity_kg, grade_requirements (opt), delivery_from, delivery_to, sourcing_latitude, sourcing_longitude, sourcing_radius_km (default 50), is_recurring (bool), recurrence_pattern (opt JSONB), price_range_min (opt), price_range_max (opt)
- `DemandPostingUpdate`: All fields optional
- `DemandPostingRead`: All fields + id, buyer_id, status, crop (nested), buyer_business_name, created_at
- `DemandStatusUpdate`: status
- `DemandPostingFilter`: crop_id (opt), status (opt), district (opt), min_quantity (opt), delivery_from (opt), page, size

### 2. app/listings/service.py

**ListingService** class:

**Harvest Listings** (farmer operations):
- `create_harvest(farmer_id, data)`:
  - Validate farmer role
  - Validate crop_id exists in crop_taxonomy
  - Validate date range (available_to >= available_from, not in past)
  - Set location using ST_MakePoint
  - Default status = 'planned' (or 'ready' if is_ready_now=True)
  - Return created listing

- `list_my_harvests(farmer_id, filters)`:
  - Paginated, filtered list of farmer's own listings
  - Eager load crop taxonomy for names

- `list_all_harvests(filters)`:
  - Public listing (for buyers to browse)
  - Only show status='ready' or 'planned' listings
  - Support geospatial filter: "within X km of point" using ST_DWithin

- `get_harvest(listing_id)` → Single listing with full details
- `update_harvest(listing_id, farmer_id, data)` → Ownership check, update fields
- `update_harvest_status(listing_id, farmer_id, new_status)`:
  - Validate status transition:
    - planned → ready, cancelled
    - ready → matched (system only), cancelled
    - matched → fulfilled (via match flow), cancelled
    - fulfilled, cancelled, expired → terminal (no changes)
  - If cancelled and had active matches, cascade update matches to 'cancelled'

- `delete_harvest(listing_id, farmer_id)` → Soft delete (set status='cancelled' + is_active=False)

**Demand Postings** (buyer operations):
- Mirror of harvest operations but for buyer role
- `create_demand(buyer_id, data)` — validate buyer role, set sourcing location
- `list_my_demands(buyer_id, filters)` — buyer's own
- `list_all_demands(filters)` — public listing for farmers to see
- `get_demand(demand_id)`
- `update_demand(demand_id, buyer_id, data)`
- `update_demand_status(demand_id, buyer_id, new_status)`
  - Status transitions: open → reviewing, confirmed, cancelled, closed
- `delete_demand(demand_id, buyer_id)` → Soft cancel

### 3. app/listings/router.py

Endpoints (prefix: `/api/v1/listings`):

```
# Harvest (Farmer)
POST   /listings/harvest                    — Create (farmer only)
GET    /listings/harvest                    — My harvests (farmer) or browse all (buyer/public)
GET    /listings/harvest/{id}               — Detail
PUT    /listings/harvest/{id}               — Update (owner farmer only)
PATCH  /listings/harvest/{id}/status        — Status transition (owner farmer only)
DELETE /listings/harvest/{id}               — Cancel/soft delete (owner)

# Demand (Buyer)
POST   /listings/demand                     — Create (buyer only)
GET    /listings/demand                     — My demands (buyer) or browse all (farmer/public)
GET    /listings/demand/{id}                — Detail
PUT    /listings/demand/{id}                — Update (owner buyer only)
PATCH  /listings/demand/{id}/status         — Status transition (owner buyer only)
DELETE /listings/demand/{id}                — Cancel/soft delete (owner)

# Browse (cross-role visibility)
GET    /listings/harvest/browse             — Buyers browse available harvests (with geo filter)
GET    /listings/demand/browse              — Farmers browse open demands (with geo filter)
```

### 4. Image Upload Endpoint

Create a shared file upload endpoint:
```
POST /api/v1/upload/image                  — Upload image, return R2 URL
```

Create `app/utils/storage.py`:
- `StorageService` class with methods:
  - `upload_image(file, folder)` → Validates file type (JPEG/PNG), validates size (≤10MB), generates unique filename, uploads to R2, returns public URL
  - For the pilot, if R2 is not configured, fall back to local filesystem storage in `/app/uploads/` with a URL prefix of `/media/`
  - Return the URL that gets stored in the listing's `photos` JSONB field

### 5. Register Router

Add listings router and upload router to main.py.

## Verification

1. Farmer can create, list, update, and cancel harvest listings
2. Buyer can create, list, update, and cancel demand postings
3. Status transitions are enforced (invalid transitions return 400)
4. Geospatial browse works (filter by distance from point)
5. Image upload returns a URL
6. Ownership checks prevent cross-user modifications
7. Pagination works with filters

## Output Report
Write report to: `/home/claude/govihub-prompts/reports/REPORT_05_LISTINGS.md`
