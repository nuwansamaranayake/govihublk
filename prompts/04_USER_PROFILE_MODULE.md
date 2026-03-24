# Prompt 04 — User & Profile Module

## Context
Auth module is complete. Users can log in via Google OAuth and receive JWT tokens. New users have `role=None` and need to complete registration.

## Objective
Build user registration completion, profile CRUD for all three roles (farmer, buyer, supplier), and user management endpoints.

## Instructions

### 1. app/users/schemas.py

**Registration**:
- `CompleteRegistrationRequest`: role (enum: farmer/buyer/supplier), name, phone (optional, for SMS), language (si/en/ta, default si), district, gn_division (optional), ds_division (optional)
- `CompleteRegistrationResponse`: full User with profile

**User**:
- `UserRead`: id, email, name, role, phone, language, district, province, avatar_url, is_verified, created_at
- `UserUpdate`: name (opt), phone (opt), language (opt), district (opt), gn_division (opt), ds_division (opt), province (opt)
- `UserLocationUpdate`: latitude, longitude (sets the PostGIS location field)

**Profiles**:
- `FarmerProfileRead/Update`: farm_size_acres, primary_crops (list of crop_id UUIDs), irrigation_type, cooperative
- `BuyerProfileRead/Update`: business_name, business_type, preferred_districts (list of strings), preferred_radius_km
- `SupplierProfileRead/Update`: business_name, categories (list of strings), coverage_area (list of strings), contact_phone, contact_whatsapp

**FCM**:
- `FCMTokenUpdate`: fcm_token (str)

### 2. app/users/service.py

**UserService** class (accepts db session in constructor):

- `complete_registration(user_id, data)`:
  - Validates user has no role yet (else 400)
  - Updates user: role, name, phone, language, district, etc.
  - Creates the appropriate profile based on role (empty FarmerProfile, BuyerProfile, or SupplierProfile)
  - Sets is_active=True
  - Returns updated user with profile

- `get_user(user_id)` → User with eager-loaded profile
- `get_user_public(user_id)` → Public view (name, district, crop types — no phone/email)
- `update_user(user_id, data)` → Update basic fields
- `update_location(user_id, lat, lng)` → Update PostGIS location using `ST_MakePoint`
- `update_farmer_profile(user_id, data)` → Validate user is farmer, update profile
- `update_buyer_profile(user_id, data)` → Validate user is buyer, update profile
- `update_supplier_profile(user_id, data)` → Validate user is supplier, update profile
- `update_fcm_token(user_id, token)` → Store FCM token for push notifications
- `update_preferences(user_id, data)` → Update NotificationPreference
- `deactivate_user(user_id)` → Set is_active=False (soft delete)

### 3. app/users/router.py

Endpoints (prefix: `/api/v1/users`):

```
POST /users/complete-registration   — Assign role & create profile (requires auth, no role yet)
GET  /users/me                      — Current user full profile
PUT  /users/me                      — Update basic fields
PUT  /users/me/location             — Update GPS location
GET  /users/{id}                    — Public profile
PUT  /users/me/farmer-profile       — Farmer profile fields (farmer only)
PUT  /users/me/buyer-profile        — Buyer profile fields (buyer only)
PUT  /users/me/supplier-profile     — Supplier profile fields (supplier only)
PUT  /users/me/fcm-token            — Register FCM token
PUT  /users/me/preferences          — Notification preferences
DELETE /users/me                    — Deactivate account
```

All endpoints require authentication (`get_current_user`).
Role-specific endpoints use `require_role()`.
`complete-registration` requires auth but explicitly allows role=None users.

### 4. Register Router in main.py

```python
from app.users.router import router as users_router
app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
```

### 5. Crop Taxonomy Endpoint

Add to users router or create a small reference router:
```
GET /api/v1/crops                   — List all active crops (paginated, filterable by category)
GET /api/v1/crops/{id}              — Single crop detail
GET /api/v1/districts               — List all Sri Lankan districts (hardcoded reference data)
```

Create `app/utils/sri_lanka.py` with:
- All 25 districts of Sri Lanka with province mapping
- All major GN divisions for Anuradhapura and Polonnaruwa (pilot districts)
- This is reference data, not a DB table

## Verification

1. Registration flow: new Google user → complete-registration → gets role + profile
2. All three role profiles have separate CRUD
3. PostGIS location update works
4. Crop taxonomy listing endpoint works
5. FCM token storage works
6. Role-based access control prevents buyer from accessing farmer endpoints
7. Public profile excludes sensitive data (phone, email)

## Output Report
Write report to: `/home/claude/govihub-prompts/reports/REPORT_04_USERS.md`
