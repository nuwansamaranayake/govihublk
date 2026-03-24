# Report 04 — User & Profile Module

## Status: READY

## What Was Built
Complete user registration flow, profile CRUD for all three roles, location management, FCM token storage, notification preferences, reference data endpoints (crops, districts).

## Files Created/Modified

### Created (5)
- `app/users/schemas.py` — 14 Pydantic schemas (registration, profiles, preferences)
- `app/users/service.py` — UserService with 10 methods
- `app/users/router.py` — 11 endpoints
- `app/utils/sri_lanka.py` — All 25 districts, DS/GN divisions for pilot areas
- `app/listings/router.py` — Crop and district reference endpoints

### Modified (1)
- `app/main.py` — Registered users and reference data routers

## User Endpoints (11)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/users/complete-registration | Assign role & create profile |
| GET | /api/v1/users/me | Current user full profile |
| PUT | /api/v1/users/me | Update basic fields |
| PUT | /api/v1/users/me/location | Update GPS location |
| GET | /api/v1/users/{id} | Public profile |
| PUT | /api/v1/users/me/farmer-profile | Farmer profile (farmer only) |
| PUT | /api/v1/users/me/buyer-profile | Buyer profile (buyer only) |
| PUT | /api/v1/users/me/supplier-profile | Supplier profile (supplier only) |
| PUT | /api/v1/users/me/fcm-token | Register FCM token |
| PUT | /api/v1/users/me/preferences | Notification preferences |
| DELETE | /api/v1/users/me | Deactivate account |

## Reference Endpoints (3)
| GET | /api/v1/crops | List crops (paginated, filterable) |
| GET | /api/v1/crops/{id} | Single crop detail |
| GET | /api/v1/districts | All Sri Lankan districts |

## Ready for Next Prompt
YES — Proceed to 05_LISTINGS_MODULE.md
