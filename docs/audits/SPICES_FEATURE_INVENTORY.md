# GoviHub Spices Pilot — Feature Inventory

**Project:** GoviHub Spices Pilot Deployment  
**Date:** 2026-04-11  
**VPS:** 187.127.135.82 (govihub-mumbai)  
**Path:** `/opt/govihub-spices/`  
**Live URL:** https://spices.govihublk.com  
**Stack:** FastAPI + Next.js 14 PWA + PostgreSQL 16 (PostGIS + pgvector) + Redis 7  
**Docker Compose:** `docker-compose.spices.yml`

---

## 1. Frontend Pages

All pages live under `govihub-web/src/app/[locale]/` and support i18n (English/Sinhala).

### Landing

| Route | Description | Status |
|-------|-------------|--------|
| `/[locale]/` | Landing / home page | Live |

### Auth Pages

| Route | Description | Status |
|-------|-------------|--------|
| `/[locale]/auth/beta-login` | Beta username/password login (no Google OAuth required) | Live |
| `/[locale]/auth/login` | Google OAuth login page | Live |
| `/[locale]/auth/register` | New user registration with role selection | Live |
| `/[locale]/auth/dev-login` | Developer quick-login (dev/staging only) | Live |
| `/[locale]/auth/select-crops` | Post-registration crop selection onboarding | Live |

### Farmer Pages

| Route | Description | Status |
|-------|-------------|--------|
| `/[locale]/farmer/dashboard` | Farmer home — active listings, matches, weather summary | Live |
| `/[locale]/farmer/listings` | Manage harvest listings (create, edit, delete) | Live |
| `/[locale]/farmer/marketplace` | Browse supply marketplace (seeds, fertilizer, equipment) | Live |
| `/[locale]/farmer/matches` | View and manage buyer-farmer matches | Live |
| `/[locale]/farmer/diagnosis` | AI crop disease diagnosis via image upload | Live |
| `/[locale]/farmer/advisory` | AI farm advisor — ask questions, get RAG-powered answers | Live |
| `/[locale]/farmer/weather` | 5-day weather forecast for farmer location | Live |
| `/[locale]/farmer/weather/[date]` | Hourly weather detail for a specific date | Live |
| `/[locale]/farmer/alerts` | Weather alerts and price alerts | Live |
| `/[locale]/farmer/notifications` | Push/in-app notification center | Live |
| `/[locale]/farmer/settings` | Profile, preferences, notification settings | Live |
| `/[locale]/farmer/more` | More menu — links to all features | Live |

### Buyer Pages

| Route | Description | Status |
|-------|-------------|--------|
| `/[locale]/buyer/dashboard` | Buyer home — active demands, match overview | Live |
| `/[locale]/buyer/demands` | Manage demand postings (what buyer wants to purchase) | Live |
| `/[locale]/buyer/marketplace` | Browse available harvest listings from farmers | Live |
| `/[locale]/buyer/matches` | View and manage farmer-buyer matches | Live |
| `/[locale]/buyer/notifications` | Notification center | Live |
| `/[locale]/buyer/settings` | Profile and preferences | Live |
| `/[locale]/buyer/more` | More menu | Live |

### Supplier Pages

| Route | Description | Status |
|-------|-------------|--------|
| `/[locale]/supplier/dashboard` | Supplier home — active supply listings | Live |
| `/[locale]/supplier/listings` | Manage supply listings (seeds, fertilizer, tools) | Live |
| `/[locale]/supplier/inquiries` | View farmer inquiries about listed products | Live |
| `/[locale]/supplier/notifications` | Notification center | Live |
| `/[locale]/supplier/settings` | Profile and preferences | Live |
| `/[locale]/supplier/more` | More menu | Live |

### Admin Pages

| Route | Description | Status |
|-------|-------------|--------|
| `/[locale]/admin/dashboard` | Admin overview — user counts, listing stats, system health | Live |
| `/[locale]/admin/users` | User management — view, edit, delete, reset passwords | Live |
| `/[locale]/admin/crops` | Crop taxonomy management — add/edit/toggle crops | Live |
| `/[locale]/admin/listings` | Review all harvest and demand listings | Live |
| `/[locale]/admin/matches` | Monitor matches, resolve disputes, cancel matches | Live |
| `/[locale]/admin/disputes` | Dispute resolution interface | Live |
| `/[locale]/admin/knowledge` | RAG knowledge base management — ingest, list, delete chunks | Live |
| `/[locale]/admin/analytics` | Platform analytics — matches, users, diagnoses, system | Live |
| `/[locale]/admin/feedback` | User feedback review and management | Live |
| `/[locale]/admin/settings` | Platform settings and cache management | Live |

---

## 2. Backend API Endpoints

Base URL: `https://spices.govihublk.com/api/v1`

### Health & Docs

| Method | Path | Name | Description |
|--------|------|------|-------------|
| GET | `/api/v1/health` | health_check | Service health check |
| GET | `/api/v1/openapi.json` | openapi | OpenAPI schema |
| GET | `/api/v1/docs` | swagger_ui_html | Swagger UI |
| GET | `/api/v1/redoc` | redoc_html | ReDoc documentation |

### Auth

| Method | Path | Name | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/google` | google_auth | Google OAuth login |
| POST | `/api/v1/auth/refresh` | refresh_token | Refresh JWT access token |
| POST | `/api/v1/auth/logout` | logout | Invalidate refresh token |
| GET | `/api/v1/auth/me` | get_me | Get current authenticated user |
| POST | `/api/v1/auth/beta/register` | beta_register | Beta username/password registration |
| POST | `/api/v1/auth/beta/login` | beta_login | Beta username/password login |
| POST | `/api/v1/auth/beta/change-password` | beta_change_password | Change beta user password |

### Users & Profiles

| Method | Path | Name | Description |
|--------|------|------|-------------|
| POST | `/api/v1/users/complete-registration` | complete_registration | Complete post-OAuth registration |
| PUT | `/api/v1/users/me/role` | change_role | Switch user role |
| GET | `/api/v1/users/me` | get_current_profile | Get full profile |
| PUT | `/api/v1/users/me` | update_current_user | Update profile fields |
| PUT | `/api/v1/users/me/location` | update_location | Update GPS location |
| GET | `/api/v1/users/{user_id}` | get_user_public | Public profile view |
| PUT | `/api/v1/users/me/farmer-profile` | update_farmer_profile | Update farmer-specific profile |
| PUT | `/api/v1/users/me/buyer-profile` | update_buyer_profile | Update buyer-specific profile |
| PUT | `/api/v1/users/me/supplier-profile` | update_supplier_profile | Update supplier-specific profile |
| PUT | `/api/v1/users/me/fcm-token` | update_fcm_token | Register FCM push token |
| GET | `/api/v1/users/me/preferences` | get_preferences | Get notification preferences |
| PUT | `/api/v1/users/me/preferences` | update_preferences | Update notification preferences |
| GET | `/api/v1/users/me/crops` | list_my_crops | List farmer's selected crops |
| POST | `/api/v1/users/me/crops` | add_crop | Add crop to farmer profile |
| PUT | `/api/v1/users/me/crops/{crop_type}` | update_crop | Update crop details |
| DELETE | `/api/v1/users/me/crops/{crop_type}` | remove_crop | Remove crop from profile |
| GET | `/api/v1/users/me/crops/available` | list_available_crops | List all available crop types |
| DELETE | `/api/v1/users/me` | deactivate_account | Deactivate user account |

### Reference Data

| Method | Path | Name | Description |
|--------|------|------|-------------|
| GET | `/api/v1/crops` | list_crops | List all crop types in taxonomy |
| GET | `/api/v1/crops/{crop_id}` | get_crop | Get crop details |
| GET | `/api/v1/districts` | list_districts | List Sri Lankan districts |

### Listings (Harvest & Demand)

| Method | Path | Name | Description |
|--------|------|------|-------------|
| POST | `/api/v1/uploads/image` | upload_listing_image | Upload listing photo to R2 |
| POST | `/api/v1/listings/harvest` | create_harvest_listing | Farmer creates harvest listing |
| GET | `/api/v1/listings/harvest` | list_my_harvests | Farmer's own harvest listings |
| GET | `/api/v1/listings/harvest/browse` | browse_harvests | Browse all active harvests |
| GET | `/api/v1/listings/harvest/{listing_id}` | get_harvest_listing | Get harvest details |
| PUT | `/api/v1/listings/harvest/{listing_id}` | update_harvest_listing | Update harvest listing |
| PATCH | `/api/v1/listings/harvest/{listing_id}/status` | update_harvest_status | Change listing status |
| DELETE | `/api/v1/listings/harvest/{listing_id}` | delete_harvest_listing | Delete harvest listing |
| POST | `/api/v1/listings/demand` | create_demand_posting | Buyer creates demand posting |
| GET | `/api/v1/listings/demand` | list_my_demands | Buyer's own demand postings |
| GET | `/api/v1/listings/demand/browse` | browse_demands | Browse all active demands |
| GET | `/api/v1/listings/demand/{posting_id}` | get_demand_posting | Get demand details |
| PUT | `/api/v1/listings/demand/{posting_id}` | update_demand_posting | Update demand posting |
| PATCH | `/api/v1/listings/demand/{posting_id}/status` | update_demand_status | Change demand status |
| DELETE | `/api/v1/listings/demand/{posting_id}` | delete_demand_posting | Delete demand posting |

### Matching

| Method | Path | Name | Description |
|--------|------|------|-------------|
| GET | `/api/v1/matches` | list_matches | List user's matches |
| GET | `/api/v1/matches/{match_id}` | get_match | Get match details |
| POST | `/api/v1/matches/{match_id}/accept` | accept_match | Accept a proposed match |
| POST | `/api/v1/matches/{match_id}/complete` | complete_match | Mark match as completed |
| POST | `/api/v1/matches/{match_id}/dismiss` | dismiss_match | Dismiss/ignore a match |
| POST | `/api/v1/matches/{match_id}/reject` | reject_match | Reject a match |
| POST | `/api/v1/matches/{match_id}/confirm` | confirm_match | Confirm a match |
| PATCH | `/api/v1/matches/{match_id}/fulfill` | fulfill_match | Mark match as fulfilled |

### Diagnosis (AI)

| Method | Path | Name | Description |
|--------|------|------|-------------|
| POST | `/api/v1/diagnosis/upload` | upload_diagnosis | Upload crop image for AI diagnosis |
| GET | `/api/v1/diagnosis/history` | get_history | Diagnosis history |
| GET | `/api/v1/diagnosis/{diagnosis_id}` | get_diagnosis | Get diagnosis result |
| POST | `/api/v1/diagnosis/{diagnosis_id}/feedback` | submit_feedback | Rate diagnosis accuracy |

### Advisory (AI)

| Method | Path | Name | Description |
|--------|------|------|-------------|
| POST | `/api/v1/advisory/ask` | ask_question | Ask farming question (RAG + LLM) |
| GET | `/api/v1/advisory/history` | get_history | Advisory question history |
| GET | `/api/v1/advisory/{question_id}` | get_advisory_detail | Get advisory detail |

### Marketplace (Supplier)

| Method | Path | Name | Description |
|--------|------|------|-------------|
| GET | `/api/v1/marketplace/categories` | list_categories | Supply categories |
| POST | `/api/v1/marketplace/listings` | create_listing | Create supply listing |
| GET | `/api/v1/marketplace/listings/mine` | list_my_listings | Supplier's own listings |
| GET | `/api/v1/marketplace/search` | search_listings | Search supply listings |
| GET | `/api/v1/marketplace/listings/{listing_id}` | get_listing | Get listing details |
| PUT | `/api/v1/marketplace/listings/{listing_id}` | update_listing | Update supply listing |
| DELETE | `/api/v1/marketplace/listings/{listing_id}` | delete_listing | Delete supply listing |
| GET | `/api/v1/marketplace/listings` | list_listings | Browse all supply listings |

### Weather

| Method | Path | Name | Description |
|--------|------|------|-------------|
| GET | `/api/v1/weather/forecast` | get_weather_forecast | 5-day forecast (authenticated) |
| GET | `/api/v1/weather/forecast/public` | get_weather_forecast_public | 5-day forecast (public) |
| GET | `/api/v1/weather/forecast/{date}` | get_hourly_by_date | Hourly forecast for specific date |
| GET | `/api/v1/weather/alerts` | get_weather_alerts | Weather alerts for user |
| GET | `/api/v1/weather/alerts/unread-count` | get_unread_alert_count | Unread weather alert count |
| PUT | `/api/v1/weather/alerts/{alert_id}/read` | mark_alert_read | Mark alert as read |
| PUT | `/api/v1/weather/alerts/read-all` | mark_all_alerts_read | Mark all alerts as read |
| GET | `/api/v1/weather/crop-profiles` | list_crop_profiles | Crop weather profiles |

### Alerts (Legacy)

| Method | Path | Name | Description |
|--------|------|------|-------------|
| GET | `/api/v1/alerts/weather` | get_my_weather | Weather for user location |
| GET | `/api/v1/alerts/weather/{lat}/{lng}` | get_weather_for_location | Weather by coordinates |
| GET | `/api/v1/alerts/prices` | get_all_prices | All crop prices |
| GET | `/api/v1/alerts/prices/{crop_id}` | get_prices_for_crop | Price for specific crop |
| GET | `/api/v1/alerts/prices/{crop_id}/trend` | get_price_trend | Price trend history |

### Notifications

| Method | Path | Name | Description |
|--------|------|------|-------------|
| GET | `/api/v1/notifications` | list_notifications | User's notifications |
| GET | `/api/v1/notifications/unread-count` | get_unread_count | Unread notification count |
| PATCH | `/api/v1/notifications/read-all` | mark_all_read | Mark all as read |
| PATCH | `/api/v1/notifications/{notification_id}/read` | mark_notification_read | Mark one as read |
| GET | `/api/v1/notifications/preferences` | get_preferences | Notification preferences |
| PUT | `/api/v1/notifications/preferences` | update_preferences | Update preferences |

### Feedback

| Method | Path | Name | Description |
|--------|------|------|-------------|
| POST | `/api/v1/feedback` | submit_feedback | Submit platform feedback |

### Sector (Multi-Tenant)

| Method | Path | Name | Description |
|--------|------|------|-------------|
| GET | `/api/v1/sector/config` | get_current_sector_config | Sector config by hostname |

### Admin

| Method | Path | Name | Description |
|--------|------|------|-------------|
| GET | `/api/v1/admin/dashboard` | get_dashboard | Admin dashboard stats |
| GET | `/api/v1/admin/users` | list_users | List all users |
| GET | `/api/v1/admin/users/{user_id}` | get_user | Get user details |
| PUT | `/api/v1/admin/users/{user_id}` | update_user | Update user |
| PUT | `/api/v1/admin/users/{user_id}/reset-password` | reset_user_password | Reset user password |
| DELETE | `/api/v1/admin/users/{user_id}` | delete_user | Delete user |
| GET | `/api/v1/admin/crops` | list_crops | List crops (admin view) |
| POST | `/api/v1/admin/crops` | create_crop | Create crop in taxonomy |
| PUT | `/api/v1/admin/crops/{crop_id}` | update_crop | Update crop |
| PATCH | `/api/v1/admin/crops/{crop_id}/toggle` | toggle_crop | Enable/disable crop |
| GET | `/api/v1/admin/matches` | list_matches | List all matches |
| GET | `/api/v1/admin/matches/{match_id}` | get_match | Get match details |
| GET | `/api/v1/admin/matches/{match_id}/enriched` | get_match_enriched | Match with full context |
| POST | `/api/v1/admin/matches/{match_id}/resolve` | resolve_dispute | Resolve match dispute |
| POST | `/api/v1/admin/matches/{match_id}/cancel` | cancel_match | Cancel match |
| GET | `/api/v1/admin/knowledge` | list_knowledge | List knowledge chunks |
| POST | `/api/v1/admin/knowledge/ingest` | ingest_knowledge | Ingest knowledge document |
| DELETE | `/api/v1/admin/knowledge/{chunk_id}` | delete_knowledge | Delete knowledge chunk |
| GET | `/api/v1/admin/knowledge/stats` | knowledge_stats | Knowledge base statistics |
| GET | `/api/v1/admin/analytics/matches` | analytics_matches | Match analytics |
| GET | `/api/v1/admin/analytics/users` | analytics_users | User analytics |
| GET | `/api/v1/admin/analytics/diagnoses` | analytics_diagnoses | Diagnosis analytics |
| GET | `/api/v1/admin/analytics/system` | analytics_system | System analytics |
| POST | `/api/v1/admin/cache/clear` | clear_cache | Clear Redis cache |
| POST | `/api/v1/admin/notifications/broadcast` | broadcast_notification | Broadcast notification to all |
| GET | `/api/v1/admin/feedback` | list_feedback | List user feedback |
| PATCH | `/api/v1/admin/feedback/{feedback_id}` | update_feedback | Update feedback status |

### MCP (Model Context Protocol)

| Method | Path | Name | Description |
|--------|------|------|-------------|
| GET | `/mcp/sse` | mcp_sse | SSE stream for MCP clients (Claude.ai) |
| POST | `/mcp/messages/{session_id}` | mcp_messages | JSON-RPC 2.0 MCP dispatcher |

**Total API endpoints: 108**

---

## 3. Feature Matrix

| Feature | Farmer | Buyer | Supplier | Admin |
|---------|--------|-------|----------|-------|
| Dashboard | Yes | Yes | Yes | Yes |
| Harvest Listings (create/manage) | Yes | Browse only | -- | View/manage all |
| Demand Postings (create/manage) | Browse only | Yes | -- | View/manage all |
| Supply Marketplace (seeds/fertilizer) | Browse/buy | Browse/buy | Create/manage | -- |
| AI Crop Diagnosis (image upload) | Yes | -- | -- | Analytics |
| AI Farm Advisory (RAG chatbot) | Yes | -- | -- | Knowledge mgmt |
| Smart Matching (harvest-to-demand) | Yes (accept/reject) | Yes (accept/reject) | -- | Monitor/resolve |
| Weather Forecast (5-day + hourly) | Yes | -- | -- | -- |
| Weather Alerts | Yes | -- | -- | -- |
| Price Alerts & Trends | Yes | Yes | -- | -- |
| Notifications (in-app + push) | Yes | Yes | Yes | Broadcast |
| Feedback Submission | Yes | Yes | Yes | Review/manage |
| User Management | -- | -- | -- | Full CRUD |
| Crop Taxonomy Management | -- | -- | -- | Full CRUD |
| Knowledge Base Management | -- | -- | -- | Ingest/delete |
| Platform Analytics | -- | -- | -- | Full access |
| Dispute Resolution | -- | -- | -- | Yes |
| Cache Management | -- | -- | -- | Clear cache |
| MCP (Claude.ai integration) | -- | -- | -- | Via token |
| Multi-Tenant Sector Config | Automatic | Automatic | Automatic | -- |
| Beta Auth (username/password) | Yes | Yes | Yes | Yes |
| Google OAuth | Yes | Yes | Yes | Yes |
| Profile & Settings | Yes | Yes | Yes | Yes |
| Crop Selection (onboarding) | Yes | -- | -- | -- |
| Image Upload (R2 storage) | Yes (listings + diagnosis) | -- | Yes (listings) | -- |

---

## 4. AI Features

| Feature | Model / Technology | Description | Status |
|---------|-------------------|-------------|--------|
| **Crop Disease Diagnosis** | Claude Sonnet 4 via OpenRouter (`anthropic/claude-sonnet-4-20250514`) | Farmers upload crop photos; the LLM analyzes images and returns disease identification, treatment recommendations, and prevention advice in English and Sinhala | Live |
| **Farm Advisory (RAG)** | Claude Sonnet 4 via OpenRouter + sentence-transformers | RAG-powered Q&A: farmer questions are embedded, matched against knowledge base chunks via pgvector cosine similarity, then answered by LLM with retrieved context | Live |
| **Knowledge Embeddings** | `paraphrase-multilingual-MiniLM-L12-v2` (384-dim, sentence-transformers) | Multilingual embedding model for knowledge base ingestion and semantic search; supports Sinhala, Tamil, and English | Live |
| **Smart Matching Engine** | Custom algorithm (no LLM) | Scores harvest-demand pairs using weighted factors: distance (35%), quantity fit (25%), date overlap (25%), listing freshness (15%); uses PostGIS for geospatial distance | Live |
| **MCP Server** | SSE-based Model Context Protocol | Exposes platform data (stats, listings, farmers, weather, knowledge base) to Claude.ai desktop via MCP tools for conversational analytics | Live |
| **Mock Mode** | N/A | When `OPENROUTER_API_KEY` is empty, diagnosis and advisory return mock responses for development/testing | Available |

### MCP Tools Available

The MCP server exposes these tools for Claude.ai integration:

- `get_platform_stats` — Platform-wide statistics
- `get_farmer_profile` — Farmer profile lookup
- `search_farmers` — Search farmer database
- `search_listings` — Search harvest/demand listings
- `get_price_trends` — Crop price trend data
- `get_weather_summary` — Weather summary
- `get_match_analytics` — Match performance analytics
- `get_diagnosis_insights` — Diagnosis statistics
- `get_supply_chain_overview` — Supply chain overview
- `search_knowledge_base` — Semantic knowledge search
- `govihub_get_platform_stats` — Platform stats (alt)
- `govihub_get_listings_summary` — Listings summary
- `govihub_get_match_performance` — Match performance
- `govihub_get_registrations` — Registration data
- `govihub_get_user_activity` — User activity
- `govihub_get_feedback` — Feedback data

---

## 5. Recent Git Commits

Last 20 commits on the deployed branch:

| Hash | Message |
|------|---------|
| `b3b25e5` | feat: add multi-tenant sector system for spices pilot deployment |
| `e77b926` | feat: add seed_spice_knowledge.py for RAG knowledge base ingestion |
| `56ff4c8` | fix: replace invalid BadgeColor 'neutral' with 'gray' in diagnosis page |
| `a0db3bd` | fix: align Farm Advisor page with API response schema |
| `224d0f4` | feat: migration 005 - convert embedding column from bytea to vector(384) |
| `01379fd` | fix: use inline vector literal in pgvector query and generate embeddings at seed time |
| `3f6096c` | chore: absorb beta server tweaks into docker-compose.beta.yml |
| `958be47` | fix: install pgvector on beta postgres and fix session poisoning in advisory |
| `04de36d` | fix: create /app/ml/embeddings with correct ownership so embedding model can cache |
| `d2b2be9` | fix: replace @app.middleware http with pure ASGI middleware to fix Content-Length mismatch |
| `65f571f` | fix: replace all asyncpg-incompatible NULL parameter patterns with dynamic query building in MCP tools |
| `7721283` | Merge branch 'beta-auth' |
| `e3e3cac` | fix: MCP auth accepts query parameter token for Claude.ai connector |
| `53adddd` | fix: remove env secrets from git, use settings.OPENROUTER_MODEL in diagnosis |
| `5795bc9` | Merge branch 'beta-auth' |
| `e37886f` | fix: handle null confidence in diagnosis — show "--" not "null%" |
| `82c1d0d` | fix: create /app/uploads directory in Dockerfile for diagnosis images |
| `fb9e414` | Merge branch 'beta-auth' |
| `4287f52` | fix: remove capture attribute from diagnosis upload input |
| `c94d7f7` | fix: remove leftover git conflict marker in service.py |

---

## 6. Database Tables

### Application Tables (public schema)

| Table | Description |
|-------|-------------|
| `users` | All user accounts (farmers, buyers, suppliers, admins) |
| `google_accounts` | Google OAuth linked accounts |
| `refresh_tokens` | JWT refresh token storage |
| `farmer_profiles` | Farmer-specific profile data (land size, district, etc.) |
| `buyer_profiles` | Buyer-specific profile data |
| `supplier_profiles` | Supplier-specific profile data |
| `farmer_crop_selections` | Crops selected by each farmer during onboarding |
| `crop_taxonomy` | Master crop type reference (name, category, season, etc.) |
| `harvest_listings` | Farmer harvest listings (crop, quantity, price, location) |
| `demand_postings` | Buyer demand postings (what they want to buy) |
| `supply_listings` | Supplier marketplace listings (seeds, fertilizer, tools) |
| `matches` | Harvest-to-demand match records with scores and status |
| `crop_diagnoses` | AI diagnosis results (image URL, disease, treatment) |
| `advisory_questions` | Farm advisory Q&A records (question, answer, sources) |
| `knowledge_chunks` | RAG knowledge base chunks with 384-dim vector embeddings |
| `price_history` | Historical crop price data |
| `weather_cache` | Cached weather API responses |
| `weather_alerts` | Weather alert records for users |
| `notifications` | In-app notification records |
| `notification_preferences` | Per-user notification settings |
| `beta_feedback` | Beta user feedback submissions |
| `alembic_version` | Database migration version tracking |

### System Tables

| Schema | Tables | Purpose |
|--------|--------|---------|
| `tiger` | 23 tables (addr, county, edges, faces, etc.) | PostGIS TIGER geocoding data |
| `topology` | 2 tables (layer, topology) | PostGIS topology support |
| `public` | `spatial_ref_sys` | PostGIS spatial reference system definitions |

**Total: 23 application tables + 26 system/PostGIS tables = 59 tables**

---

## 7. Environment Configuration

### Backend Environment (`.env.spices`)

| Variable | Purpose |
|----------|---------|
| `APP_NAME` | Application display name |
| `APP_ENV` | Environment (production/staging/development) |
| `APP_DEBUG` | Debug mode toggle |
| `APP_URL` | Public application URL |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) |
| `DB_PASS` | PostgreSQL password |
| `DATABASE_URL` | Async PostgreSQL connection string (asyncpg) |
| `DATABASE_URL_SYNC` | Sync PostgreSQL connection string (for Alembic) |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET_KEY` | Secret key for JWT token signing |
| `JWT_ALGORITHM` | JWT algorithm (HS256) |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL in minutes |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL in days |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM access (empty = mock mode) |
| `OPENROUTER_MODEL` | LLM model identifier (default: `anthropic/claude-sonnet-4-20250514`) |
| `OPENROUTER_BASE_URL` | OpenRouter API base URL |
| `OPENWEATHER_API_KEY` | OpenWeatherMap API key for weather data |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name for media storage |
| `R2_PUBLIC_URL` | Public URL for R2 media (CDN) |
| `FCM_CREDENTIALS_PATH` | Path to Firebase Cloud Messaging credentials JSON |
| `SMS_PROVIDER` | SMS provider (twilio) |
| `MCP_ADMIN_SECRET` | Secret token for MCP server authentication |

### Frontend Environment (`.env.spices.frontend`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | API base URL (https://spices.govihublk.com/api/v1) |
| `NEXT_PUBLIC_APP_URL` | App public URL (https://spices.govihublk.com) |

### Docker Compose Services (`docker-compose.spices.yml`)

| Service | Container | Port (host:container) | Notes |
|---------|-----------|----------------------|-------|
| `govihub-api-spices` | FastAPI (Gunicorn + Uvicorn) | 8003:8000 | 1 worker, Traefik labels for `spices.govihublk.com` |
| `govihub-web-spices` | Next.js 14 | 3003:3000 | Traefik labels, lower priority than API |
| `postgres-spices` | PostgreSQL 16 + PostGIS + pgvector | 5435:5432 | Custom Dockerfile, health check enabled |
| `redis-spices` | Redis 7 Alpine | 6382:6379 | 256MB max memory, allkeys-lru eviction |

### Traefik Routing

- Host: `spices.govihublk.com`
- API routes: `PathPrefix(/api)` or `PathPrefix(/mcp)` with priority 20
- Web routes: All other paths with priority 10
- TLS: Let's Encrypt via `certresolver=letsencrypt`

---

## Summary

The GoviHub Spices Pilot is a fully deployed, production-ready platform with:

- **41 frontend pages** across 4 roles (farmer, buyer, supplier, admin) + auth + landing
- **108 backend API endpoints** covering auth, users, listings, matching, diagnosis, advisory, weather, marketplace, notifications, admin, MCP, and sector config
- **4 AI-powered features**: crop disease diagnosis, RAG farm advisory, semantic knowledge search, and smart matching
- **23 application database tables** with PostGIS spatial and pgvector semantic capabilities
- **Multi-tenant architecture** via sector config system, currently configured for the spices vertical
- **MCP integration** enabling Claude.ai to query platform data conversationally
- **Beta auth system** allowing username/password login alongside Google OAuth
