# REPORT 09 — Supply Marketplace & Weather/Price Alerts

**Date:** 2026-03-23
**Prompt:** 09 — Supply Marketplace & Weather/Price Alerts
**Status:** Complete

---

## Files Created

### Marketplace Module

| File | Description |
|------|-------------|
| `govihub-api/app/marketplace/schemas.py` | Pydantic v2 schemas for supply listings |
| `govihub-api/app/marketplace/service.py` | CRUD service with PostGIS proximity search |
| `govihub-api/app/marketplace/router.py` | 7 REST endpoints under `/api/v1/marketplace` |

### Alerts Module

| File | Description |
|------|-------------|
| `govihub-api/app/alerts/weather.py` | OpenWeather API client with Redis cache + mock fallback |
| `govihub-api/app/alerts/prices.py` | PriceHistory queries, trend analysis, alert evaluation |
| `govihub-api/app/alerts/schemas.py` | Pydantic schemas for weather and price responses |
| `govihub-api/app/alerts/router.py` | 5 REST endpoints under `/api/v1/alerts` |
| `govihub-api/app/alerts/tasks.py` | Placeholder background task stubs |

### Scripts

| File | Description |
|------|-------------|
| `govihub-api/scripts/seed_prices.py` | 30-day LKR price seed for 4 crops × 3 markets |

### Updated

| File | Change |
|------|--------|
| `govihub-api/app/main.py` | Uncommented marketplace and alerts router imports and `include_router` calls |

---

## Marketplace Module Detail

### Schemas (`marketplace/schemas.py`)

- **`SupplyListingCreate`** — Full create payload with:
  - `category` (SupplyCategory enum from model: seeds, fertilizer, pesticide, equipment, tools, irrigation, other)
  - `name`, `name_si`, `description`
  - `price` (LKR), `unit` (max 20 chars), `stock_quantity`
  - `latitude` / `longitude` (paired validation)
  - `photos` (list of URL strings, stored in JSONB `images.urls`)
  - `delivery_available`, `delivery_radius_km`
  - Model validators: lat/lng must come in pairs; `delivery_radius_km` required when delivery is enabled

- **`SupplyListingUpdate`** — All fields optional, same validations

- **`SupplyListingRead`** — Full output schema with `distance_km` field for proximity search results

- **`SupplySearchFilter`** — Composite filter with keyword, category, proximity, price range, delivery flag, pagination

- **`SupplyListingPage`** — Paginated envelope (total, page, page_size, results)

### Service (`marketplace/service.py`)

- **`create_listing(supplier_id, data)`** — Supplier/admin only; converts lat/lng to `SRID=4326;POINT(...)` WKT for PostGIS Geography column; stores photos in JSONB

- **`update_listing(listing_id, supplier_id, data)`** — Ownership check (ForbiddenError if not owner)

- **`delete_listing(listing_id, supplier_id)`** — Soft delete: sets `status = discontinued`

- **`list_my_listings(supplier_id, page, page_size)`** — Paged, excludes discontinued

- **`search_listings(filters)`** — When lat/lng provided: uses `ST_DWithin` for radius filter and `ST_Distance / 1000` for distance label, orders by proximity. Keyword search uses ILIKE on name and description. Returns `(total, list[dict])` with `distance_km` populated for proximity results.

- **`get_listing(listing_id)`** — Single fetch, raises 404 for missing or discontinued

- **`_listing_to_dict(listing)`** — Helper extracting lat/lng from GeoAlchemy2 Geography using `to_shape()`

### Router (`marketplace/router.py`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/categories` | Active user | List all supply categories |
| `POST` | `/listings` | Supplier/Admin | Create listing |
| `GET` | `/listings` | Active user | Browse active listings (category filter) |
| `GET` | `/listings/mine` | Supplier/Admin | My listings |
| `GET` | `/listings/{id}` | Active user | Get single listing |
| `PUT` | `/listings/{id}` | Supplier/Admin | Update listing |
| `DELETE` | `/listings/{id}` | Supplier/Admin | Soft-delete listing |
| `GET` | `/search` | Active user | Full search with proximity/keyword/price filters |

---

## Weather Alerts Module Detail

### WeatherService (`alerts/weather.py`)

- **`fetch_forecast(lat, lng)`** — Checks Redis cache (`weather:forecast:{lat}:{lng}`, 1h TTL). If miss, calls OpenWeather `/forecast` API (5-day / 3-hour, metric units). Falls back to deterministic mock data if `OPENWEATHER_API_KEY` is empty or on HTTP error.

- **`check_weather_alerts(forecast)`** — Iterates forecast periods checking:
  - Heavy rain: `rain.3h >= 20mm` (moderate) / `>= 40mm` (high)
  - Heat: `temp >= 35°C` (moderate) / `>= 38°C` (high)
  - Strong wind: `speed >= 10 m/s` (moderate)
  - Extreme wind: `speed >= 17 m/s` (high)

- **`get_forecast_for_user(db, user_id)`** — Loads user's stored Geography location; falls back to Colombo (6.9271, 79.8612); returns combined forecast + alerts dict

### Router (`alerts/router.py`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/weather` | Forecast for authenticated user's location |
| `GET` | `/weather/{lat}/{lng}` | Forecast for explicit coordinates |
| `GET` | `/prices` | All active crops with latest prices and alerts |
| `GET` | `/prices/{crop_id}` | Latest prices + alerts for one crop |
| `GET` | `/prices/{crop_id}/trend` | Daily OHLC-style trend (configurable days) |

---

## Price Alerts Module Detail

### PriceService (`alerts/prices.py`)

- **`fetch_latest_prices(crop_id)`** — Subquery finds `MAX(recorded_date)` per market; returns most recent price per market

- **`get_prices_for_crop(crop_id, days=30)`** — Full history over last N days, ordered by date

- **`check_price_alerts(crop_id)`** — Compares today's price against 7-day average per market:
  - Drop >= 15% → `price_drop` alert (high if >= 30%)
  - Surge >= 20% → `price_surge` alert (high if >= 40%)

- **`get_market_prices_for_user(db, user_id)`** — All active crops with latest prices and alerts

- **`get_trend_data(crop_id, days=30)`** — Daily avg/min/max per market, suitable for charting

---

## Seed Script Detail (`scripts/seed_prices.py`)

- **Crops targeted:** Rice (Nadu), Tomato, Red Chili, Banana (Kolikuttu)
- **Markets:** Dambulla Economic Centre, Colombo Manning Market, Anuradhapura Market
- **Duration:** 30 days from today backwards

**Price profiles (LKR/kg):**

| Crop | Base Price | Daily Volatility | Market Premium (Colombo) |
|------|-----------|-----------------|--------------------------|
| Rice (Nadu) | 115 | 3% | +8 |
| Tomato | 180 | 8% | +25 |
| Red Chili | 650 | 6% | +40 |
| Banana (Kolikuttu) | 95 | 4% | +12 |

- Uses a **mean-reverting random walk** (`random.gauss` + reversion pull) seeded deterministically per crop for reproducible data
- Anuradhapura market has lower prices (farming belt proximity)
- Deduplication: skips records where `(crop_id, market_name, recorded_date, source='seed_data')` already exists
- Usage: `python scripts/seed_prices.py` (requires DB running and crops seeded via `seed_crops.py`)

---

## Background Tasks (`alerts/tasks.py`)

Four async stub functions with complete implementation sketches (commented):

| Task | Purpose |
|------|---------|
| `fetch_all_weather()` | Cache weather for all GN divisions in WeatherCache table |
| `send_weather_alerts()` | Evaluate cached forecasts; dispatch push/SMS to affected users |
| `fetch_all_prices()` | Pull from HARTI/Govimithuru market data API into PriceHistory |
| `send_price_alerts()` | Evaluate price movements; notify farmers with matching crops |

Each stub documents:
- Trigger conditions and data sources
- Implementation steps as inline comments
- Redis deduplication strategy
- Integration points with notification service

---

## main.py Changes

```python
# Before (both commented out):
# from app.marketplace.router import router as marketplace_router
# from app.alerts.router import router as alerts_router
# app.include_router(marketplace_router, ...)
# app.include_router(alerts_router, ...)

# After (both active):
from app.marketplace.router import router as marketplace_router
from app.alerts.router import router as alerts_router
app.include_router(marketplace_router, prefix="/api/v1/marketplace", tags=["Marketplace"])
app.include_router(alerts_router, prefix="/api/v1/alerts", tags=["Alerts"])
```

---

## Key Design Decisions

1. **PostGIS proximity** uses `ST_DWithin` for efficient index-driven radius filtering and `ST_Distance / 1000` for distance labeling in km — same pattern as HarvestListing proximity search in the listings module.

2. **Soft delete** keeps listing records in the database with `status = discontinued` rather than hard deleting, preserving supplier history and allowing recovery.

3. **Weather mock fallback** is activated when `OPENWEATHER_API_KEY` is absent (empty string), making the service fully functional in development without external dependencies.

4. **Redis cache key** format `weather:forecast:{lat:.4f}:{lng:.4f}` clusters nearby coordinates. For production, rounding to 2 decimal places (~1km precision) would increase cache hit rate.

5. **Price alerts** use a 7-day rolling average as baseline rather than a fixed absolute threshold, making alerts adaptive to seasonal price levels.

6. **Seed script determinism** — `random.seed(str(crop_id))` ensures the same 30-day price series is generated on every run, allowing idempotent re-seeding.
