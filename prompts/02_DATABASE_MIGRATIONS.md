# Prompt 02 — Database Models, Migrations & Seed Data

## Context
Prompt 01 created the project scaffolding. The FastAPI app skeleton, Docker Compose, and directory structure exist. Now we build the complete data layer.

## Objective
Implement all SQLAlchemy models for the 11+ core tables, configure Alembic for async migrations, create the initial migration, and build seed scripts for crop taxonomy and knowledge base.

## Prerequisites
- Prompt 01 completed successfully
- `/home/claude/govihub/govihub-api/app/database.py` exists with async engine setup

## Instructions

### 1. Base Model Mixin (app/models/base.py)

Create a shared base with:
- `id`: UUID primary key with `server_default=func.gen_random_uuid()`
- `created_at`: TIMESTAMPTZ with `server_default=func.now()`
- `updated_at`: TIMESTAMPTZ with `onupdate=func.now()`
- Table naming convention: lowercase snake_case from class name
- SQLAlchemy MetaData with constraint naming convention for Alembic:
  ```python
  convention = {
      "ix": "ix_%(column_0_label)s",
      "uq": "uq_%(table_name)s_%(column_0_name)s",
      "ck": "ck_%(table_name)s_%(constraint_name)s",
      "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
      "pk": "pk_%(table_name)s"
  }
  ```

### 2. All Models

Create each model in its respective module directory. Use `app/{module}/models.py`.

**app/auth/models.py**:
- `RefreshToken`: id, user_id (FK→users), token (unique, indexed), expires_at, is_revoked, created_at
- `GoogleAccount`: id, user_id (FK→users, unique), google_id (unique), email, name, picture_url, created_at

**app/users/models.py**:
- `User`: Exactly matching the architecture doc schema:
  - id, phone (unique, nullable — Google OAuth may not provide), email (unique, from Google), role (enum: farmer/buyer/supplier/admin), name, language (default 'si'), location (Geography POINT 4326), gn_division, ds_division, district, province, is_active, is_verified, avatar_url, created_at, updated_at, last_login_at
  - Relationships: farmer_profile, buyer_profile, supplier_profile, harvest_listings, demand_postings, crop_diagnoses, notifications
- `FarmerProfile`: id, user_id (unique FK→users), farm_size_acres, primary_crops (JSONB), irrigation_type, cooperative, created_at
- `BuyerProfile`: id, user_id (unique FK→users), business_name, business_type, preferred_districts (JSONB), preferred_radius_km (default 50), created_at
- `SupplierProfile`: id, user_id (unique FK→users), business_name, categories (JSONB), coverage_area (JSONB), contact_phone, contact_whatsapp, created_at

**app/listings/models.py**:
- `CropTaxonomy`: id, code (unique), name_en, name_si, name_ta (nullable), category (enum: vegetable/fruit/grain/pulse/spice), season (JSONB), avg_yield_kg, is_active (default True)
- `HarvestListing`: Exactly per architecture doc. Include all indexes. Status CHECK constraint.
- `DemandPosting`: Exactly per architecture doc. Include all indexes. Status CHECK constraint. Include recurrence_pattern JSONB.

**app/matching/models.py**:
- `Match`: Exactly per architecture doc. UNIQUE(harvest_id, demand_id). All status values in CHECK. Include confirmed_at, fulfilled_at timestamps.

**app/diagnosis/models.py**:
- `CropDiagnosis`: Exactly per architecture doc. Include model_version, user_feedback with CHECK constraint.

**app/advisory/models.py**:
- `KnowledgeChunk`: Exactly per architecture doc. vector(384) using pgvector. Include ivfflat index.
- `AdvisoryQuestion`: id, user_id (FK→users), question_text, answer_text, chunks_used (JSONB — list of chunk IDs), language, created_at

**app/marketplace/models.py**:
- `SupplyListing`: Exactly per architecture doc. Include GIST index on location.

**app/notifications/models.py**:
- `Notification`: Exactly per architecture doc. Composite index on (user_id, is_read).
- `NotificationPreference`: id, user_id (unique FK→users), push_enabled (default True), sms_enabled (default True), match_alerts (default True), weather_alerts (default True), price_alerts (default True), quiet_hours_start (Time, nullable), quiet_hours_end (Time, nullable)

**app/alerts/models.py**:
- `PriceHistory`: id, crop_id (FK→crop_taxonomy), market_name, price_per_kg, unit, recorded_date, source, created_at
  - Indexes: (crop_id, recorded_date), (market_name)
- `WeatherCache`: id, gn_division, forecast_data (JSONB), fetched_at, expires_at
  - Index: (gn_division), (expires_at)

### 3. Create `app/models/__init__.py`

Import ALL models here so Alembic can discover them:
```python
from app.auth.models import RefreshToken, GoogleAccount
from app.users.models import User, FarmerProfile, BuyerProfile, SupplierProfile
from app.listings.models import CropTaxonomy, HarvestListing, DemandPosting
from app.matching.models import Match
from app.diagnosis.models import CropDiagnosis
from app.advisory.models import KnowledgeChunk, AdvisoryQuestion
from app.marketplace.models import SupplyListing
from app.notifications.models import Notification, NotificationPreference
from app.alerts.models import PriceHistory, WeatherCache
```

### 4. Alembic Configuration

Update `migrations/env.py`:
- Import `app.models` to register all models
- Configure async engine from `app.config.settings`
- Use `target_metadata = Base.metadata`
- Configure `run_migrations_online()` for async

Update `alembic.ini`:
- Set `sqlalchemy.url` to read from env (or leave blank, env.py handles it)

Generate initial migration:
```bash
# The migration should be generated by running:
alembic revision --autogenerate -m "initial_schema"
```

Write the migration manually if autogenerate is not available in this context. The migration must:
- Create all extensions: uuid-ossp, postgis, vector
- Create all tables in dependency order (users first, then profiles, then listings, then matches, etc.)
- Create all indexes including GIST and ivfflat
- Create all CHECK constraints

### 5. Seed Scripts

**scripts/seed_crops.py**: Seed the `crop_taxonomy` table with 30+ crops relevant to Anuradhapura & Polonnaruwa (North Central Province, dry zone):

Vegetables: Rice (multiple varieties: samba, red, white), Tomato, Brinjal/Eggplant, Okra/Ladies Finger, Long Beans, Snake Gourd, Bitter Gourd, Pumpkin, Cucumber, Winged Bean, Drumstick/Moringa, Green Chili, Capsicum

Fruits: Banana (multiple varieties), Mango, Papaya, Watermelon, Coconut, Lime, Guava

Grains/Pulses: Paddy (multiple varieties), Green Gram/Mung Bean, Cowpea, Black Gram, Soybean, Maize/Corn, Groundnut

Spices: Turmeric, Ginger, Pepper, Cinnamon, Clove

For each crop, provide:
- `code`: e.g., `VEG-TOM-001`, `GRN-PAD-001`
- `name_en`: English name
- `name_si`: Sinhala name (use accurate Sinhala — e.g., තක්කාලි for Tomato, බඩ ඉරිඟු for Maize, කහ for Turmeric)
- `name_ta`: Tamil name placeholder or actual if known
- `category`: vegetable/fruit/grain/pulse/spice
- `season`: JSON with growing season data for dry zone

The script should:
- Use SQLAlchemy async session
- Be idempotent (skip if code already exists)
- Log what was inserted vs skipped

**scripts/seed_knowledge.py**: Placeholder script structure that will:
- Read markdown/text files from `knowledge_base/` directory
- Chunk them into ~500-word segments
- Generate embeddings using sentence-transformers (MiniLM-L12-v2)
- Insert into `knowledge_chunks` table
- For now, create the script structure with a few sample knowledge chunks hardcoded (rice cultivation best practices in Sinhala, basic pest management)

**scripts/create_admin.py**: Script to create an admin user:
- Takes email as argument
- Creates user with role='admin', is_verified=True
- Links a GoogleAccount entry

## Verification

1. All model files exist and have proper imports
2. `app/models/__init__.py` imports all models without errors
3. Migration file exists in `migrations/versions/`
4. `scripts/seed_crops.py` contains 30+ Sri Lankan crops with Sinhala names
5. All models use UUID primary keys, TIMESTAMPTZ timestamps
6. PostGIS Geography fields are correctly typed
7. pgvector embedding field is vector(384)
8. All CHECK constraints match architecture doc values
9. Count: 14+ model classes across 8+ files

## Output Report
Write report to: `/home/claude/govihub-prompts/reports/REPORT_02_DATABASE.md`
