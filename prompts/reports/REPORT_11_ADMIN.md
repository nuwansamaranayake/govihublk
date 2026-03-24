# Report 11 — Admin Module

## Status: COMPLETE

## Files Created / Modified

### New Files
| File | Lines | Purpose |
|------|-------|---------|
| `govihub-api/app/admin/schemas.py` | ~280 | All Pydantic request/response models for admin module |
| `govihub-api/app/admin/service.py` | ~430 | AdminService class with all business logic |
| `govihub-api/app/admin/router.py` | ~330 | FastAPI router — 20 endpoints, all admin-guarded |

### Modified Files
| File | Change |
|------|--------|
| `govihub-api/app/main.py` | Uncommented admin router import and `include_router` registration |

---

## Schemas (`app/admin/schemas.py`)

| Schema | Purpose |
|--------|---------|
| `DashboardStats` | 16-field aggregate stats response |
| `AdminUserListFilter` | Query filter for user list (role, district, active, verified, search, pagination) |
| `AdminUserRead` | Full user detail including admin-only fields (is_active, is_verified, last_login_at) |
| `AdminUserUpdate` | Mutable user fields + admin-only: role, is_active, is_verified |
| `AdminUserListResponse` | Paginated user list wrapper |
| `CropTaxonomyCreate` | New crop entry creation (code, names, category, season, avg_yield) |
| `CropTaxonomyUpdate` | Partial crop update |
| `CropTaxonomyRead` | Full crop read with timestamps |
| `CropListFilter` | Crop list filters (category, is_active, search, pagination) |
| `CropListResponse` | Paginated crop list wrapper |
| `AdminMatchListFilter` | Match filters (status, min_score, date range, pagination) |
| `AdminMatchRead` | Full match detail with all fields |
| `AdminMatchListResponse` | Paginated match list wrapper |
| `ResolveDisputeRequest` | Dispute resolution (resolution text, optional notes, new_status enum) |
| `CancelMatchRequest` | Match cancellation reason |
| `KnowledgeChunkListFilter` | Knowledge chunk filters (language, category, source, search, pagination) |
| `KnowledgeIngestRequest` | Knowledge ingestion payload (content, source, title, language, category, tags, metadata) |
| `KnowledgeChunkRead` | Full chunk detail |
| `KnowledgeChunkListResponse` | Paginated chunk list wrapper |
| `KnowledgeStats` | Aggregate knowledge base stats |
| `MatchAnalytics` | Match analytics with daily time series |
| `UserAnalytics` | User registration analytics with daily time series |
| `DiagnosisAnalytics` | Diagnosis analytics with disease ranking and feedback breakdown |
| `SystemHealth` | Real-time system health snapshot |
| `BroadcastNotificationRequest` | Broadcast notification payload |
| `BroadcastNotificationResponse` | Broadcast result with queued count |

---

## Service (`app/admin/service.py`)

### `AdminService` Methods

#### Dashboard
- `get_dashboard_stats()` — 14 parallel aggregate queries covering users, listings, matches, diagnoses, knowledge base

#### User Management
- `list_users(filters)` — paginated, filterable by role/district/active/verified/search (ilike on name, email, phone)
- `get_user_detail(user_id)` — single user lookup with 404
- `update_user(user_id, data)` — field-level update including role enum coercion
- `delete_user(user_id)` — soft-delete (sets is_active=False)

#### Crop Taxonomy
- `list_crops(filters)` — paginated, filterable
- `create_crop(data)` — creates with CropCategory enum coercion
- `update_crop(crop_id, data)` — partial update with enum coercion
- `toggle_crop(crop_id)` — flips is_active boolean

#### Match Management
- `list_matches(filters)` — admin-global (no ownership scope), filterable by status/score/date range
- `get_match_detail(match_id)` — no ownership check
- `resolve_dispute(match_id, resolution, notes, new_status)` — validates disputed status, transitions to fulfilled/cancelled, appends resolution to notes
- `cancel_match(match_id, reason)` — validates non-terminal status, force-cancels

#### Knowledge Base
- `list_knowledge_chunks(filters)` — paginated, filterable
- `ingest_knowledge(...)` — creates chunk, auto-generates embedding via existing `embedding_service`, gracefully handles embedding failures
- `delete_knowledge_chunk(chunk_id)` — hard delete
- `get_knowledge_stats()` — counts by language, category, embedding coverage (uses raw SQL for pgvector IS NOT NULL)

#### Analytics
- `get_match_analytics(date_from, date_to)` — status breakdown, avg score, confirmed/fulfillment/dispute rates, per-day time series
- `get_user_analytics(date_from, date_to)` — new registrations by role/district, active users, per-day time series
- `get_diagnosis_analytics(date_from, date_to)` — status breakdown, avg confidence, top-10 diseases, feedback distribution, per-day time series
- `get_system_health()` — live DB ping, user counts, 24h activity counters, pending/disputed alerts

#### Notifications
- `broadcast_notification(...)` — counts targeted users, logs intent, returns queued count (FCM dispatch is handled by the notifications module)

---

## Router (`app/admin/router.py`)

All 20 endpoints use `require_role("admin")` via the `AdminRequired` dependency alias.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/dashboard` | Platform stats |
| GET | `/api/v1/admin/users` | List users |
| GET | `/api/v1/admin/users/{id}` | User detail |
| PUT | `/api/v1/admin/users/{id}` | Update user |
| DELETE | `/api/v1/admin/users/{id}` | Deactivate user (204) |
| GET | `/api/v1/admin/crops` | List crops |
| POST | `/api/v1/admin/crops` | Create crop (201) |
| PUT | `/api/v1/admin/crops/{id}` | Update crop |
| PATCH | `/api/v1/admin/crops/{id}/toggle` | Toggle crop active |
| GET | `/api/v1/admin/matches` | List matches |
| GET | `/api/v1/admin/matches/{id}` | Match detail |
| POST | `/api/v1/admin/matches/{id}/resolve` | Resolve dispute |
| POST | `/api/v1/admin/matches/{id}/cancel` | Cancel match |
| GET | `/api/v1/admin/knowledge` | List knowledge chunks |
| POST | `/api/v1/admin/knowledge/ingest` | Ingest chunk (201) |
| DELETE | `/api/v1/admin/knowledge/{id}` | Delete chunk (204) |
| GET | `/api/v1/admin/knowledge/stats` | Knowledge stats |
| GET | `/api/v1/admin/analytics/matches` | Match analytics |
| GET | `/api/v1/admin/analytics/users` | User analytics |
| GET | `/api/v1/admin/analytics/diagnoses` | Diagnosis analytics |
| GET | `/api/v1/admin/analytics/system` | System health |
| POST | `/api/v1/admin/notifications/broadcast` | Broadcast notification |

---

## Integration Notes

- **Auth guard**: All routes use `require_role("admin")` from `app.dependencies`. Users with any other role (farmer, buyer, supplier) receive a 403.
- **Soft delete**: User deletion sets `is_active=False`; records are retained for audit.
- **Dispute resolution**: `resolve_dispute` validates the match is in `disputed` status before transitioning. Appends a `[DISPUTE RESOLVED]` prefix to notes for audit trail.
- **Knowledge ingestion**: Reuses `app.advisory.embeddings.embedding_service` for automatic vector embedding. Embedding failure is non-fatal — chunk is stored without embedding.
- **Analytics time series**: Uses raw SQL `DATE(created_at)` grouping for per-day counts (PostgreSQL compatible).
- **Broadcast**: Counts targeted users and logs; actual push notification dispatch is deferred to the notifications module.
- **main.py**: Admin router is now fully registered at `/api/v1/admin` with tag `Admin`.
