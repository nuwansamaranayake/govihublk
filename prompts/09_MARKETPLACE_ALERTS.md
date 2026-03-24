# Prompt 09 — Supply Marketplace & Weather/Price Alerts

## Context
Core AI services (matching, diagnosis, advisory) are built. Now add the supply marketplace and alert systems.

## Objective
Build supplier listing CRUD with geospatial search, weather alert integration (OpenWeather API), and market price feed system (HARTI data placeholder).

## Instructions

### 1. Supply Marketplace (app/marketplace/)

**schemas.py**:
- `SupplyListingCreate`: category (enum: fertilizer/seeds/equipment/transport/chemicals/labor), title, description, price, price_unit (per_kg/per_bag/per_day/flat_rate), availability (available/out_of_stock/seasonal), latitude, longitude, coverage_radius_km, photos (list of URLs)
- `SupplyListingUpdate`: All fields optional
- `SupplyListingRead`: All fields + id, supplier (nested brief), created_at
- `SupplySearchFilter`: category (opt), keyword (opt), latitude (opt), longitude (opt), radius_km (opt, default 50), page, size

**service.py** — SupplyMarketplaceService:
- `create_listing(supplier_id, data)` — supplier role only
- `update_listing(listing_id, supplier_id, data)` — ownership check
- `delete_listing(listing_id, supplier_id)` — soft delete
- `list_my_listings(supplier_id, filters)` — supplier's own
- `search_listings(filters)` — public search with:
  - Category filter
  - Keyword search (ILIKE on title + description)
  - Proximity sort using PostGIS ST_Distance when lat/lng provided
  - Only show is_active=True listings

**router.py** (prefix: `/api/v1/marketplace`):
```
POST   /marketplace/listings          — Create (supplier only)
GET    /marketplace/listings          — My listings (supplier) 
PUT    /marketplace/listings/{id}     — Update (owner only)
DELETE /marketplace/listings/{id}     — Deactivate (owner only)
GET    /marketplace/search            — Public search with filters
GET    /marketplace/listings/{id}     — Detail view
GET    /marketplace/categories        — List available categories
```

### 2. Weather Alerts (app/alerts/)

**weather.py** — WeatherService:
- `fetch_forecast(latitude, longitude)`:
  - Call OpenWeather 3-day forecast API
  - Parse response into structured format
  - Cache in Redis with 1-hour TTL (key: `weather:{lat:.2f}:{lng:.2f}`)
  - Return: current temp, humidity, wind, 3-day forecast summary
  
- `check_weather_alerts(forecast_data)`:
  - Thresholds: heavy rain >50mm/day, heat stress >38°C, high wind >50km/h
  - Returns list of alert conditions met

- `get_forecast_for_user(user_id)`:
  - Get user's location from profile
  - Fetch forecast (cache-first)
  - Check alert thresholds
  - Return forecast + any active alerts

**Placeholder for production**: If OPENWEATHER_API_KEY is not set, return mock data:
```python
MOCK_FORECAST = {
    "current": {"temp_c": 32, "humidity": 75, "wind_kmh": 12, "description": "Partly cloudy"},
    "daily": [
        {"date": "today", "high": 34, "low": 26, "rain_mm": 5, "description": "Scattered showers"},
        {"date": "tomorrow", "high": 33, "low": 25, "rain_mm": 0, "description": "Sunny"},
        {"date": "day_after", "high": 35, "low": 27, "rain_mm": 15, "description": "Thunderstorms"},
    ],
    "alerts": []
}
```

### 3. Price Alerts (app/alerts/)

**prices.py** — PriceService:
- `fetch_latest_prices(crop_id)`:
  - Query PriceHistory table for latest records
  - Cache in Redis with 24-hour TTL
  - Return: current price, 7-day trend, percentage change

- `get_prices_for_crop(crop_id, days=30)`:
  - Historical prices from PriceHistory table
  - Calculate: min, max, avg, trend direction

- `check_price_alerts(crop_id)`:
  - Compare latest price to 7-day average
  - Alert if ±10% daily change or new seasonal high/low

- `get_market_prices_for_user(user_id)`:
  - Get farmer's primary crops from profile
  - Fetch latest prices for each crop
  - Return aggregated price dashboard data

**scripts/seed_prices.py**: Generate sample price data for pilot crops:
- 30 days of realistic price data for rice, tomato, onion, chili, banana
- Markets: Dambulla Economic Center, Colombo Manning Market, Anuradhapura Market
- Prices in LKR per kg (realistic ranges for Sri Lanka 2026)

### 4. Alerts Router (app/alerts/router.py)

```
GET    /alerts/weather                — Weather forecast for current user location
GET    /alerts/weather/{lat}/{lng}    — Weather for arbitrary location
GET    /alerts/prices                 — Prices for user's crops
GET    /alerts/prices/{crop_id}       — Price history for specific crop
GET    /alerts/prices/{crop_id}/trend — Price trend data (for charts)
```

All require auth except weather by coordinates.

### 5. Background Tasks (app/alerts/tasks.py)

Define task functions (will be scheduled via cron or background worker later):
- `fetch_all_weather()` — Fetch weather for all active user locations, check alerts, create notifications
- `fetch_all_prices()` — Fetch HARTI prices (placeholder), update PriceHistory, check alerts
- `send_weather_alerts()` — For users with weather alert conditions, create Notification records
- `send_price_alerts()` — For users with price alert conditions, create Notification records

For now, these are callable functions. In prompt 15 we'll wire them to a scheduler.

### 6. Register Routers

Add marketplace and alerts routers to main.py.

## Verification

1. Supplier can create, update, delete supply listings
2. Proximity search returns results sorted by distance
3. Category and keyword filters work
4. Weather endpoint returns forecast data (mock or real)
5. Price endpoint returns historical data with trends
6. Price seed script populates realistic data
7. Alert threshold checking identifies conditions correctly

## Output Report
Write report to: `/home/claude/govihub-prompts/reports/REPORT_09_MARKETPLACE_ALERTS.md`
