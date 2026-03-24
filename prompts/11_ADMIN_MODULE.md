# Prompt 11 — Admin Module

## Context
All user-facing modules are built. Now build the platform administration backend.

## Objective
Implement admin dashboard API, user management, crop taxonomy management, match quality monitoring, dispute resolution, knowledge base management, and platform analytics.

## Instructions

### 1. app/admin/schemas.py

**Dashboard**:
- `DashboardStats`: total_users, active_users_7d, total_farmers, total_buyers, total_suppliers, total_harvests_active, total_demands_active, total_matches, matches_fulfilled, matches_disputed, total_diagnoses, diagnoses_this_week, avg_match_score

**User Management**:
- `AdminUserListFilter`: role (opt), district (opt), is_active (opt), is_verified (opt), search (opt — name/email/phone), page, size
- `AdminUserRead`: Full user with profile, registration date, last_login, activity stats (listings_count, matches_count)
- `AdminUserUpdate`: is_active, is_verified, role (for role reassignment)

**Crop Taxonomy**:
- `CropTaxonomyCreate/Update`: code, name_en, name_si, name_ta, category, season, avg_yield_kg, is_active

**Matches**:
- `AdminMatchListFilter`: status (opt), district (opt), date_from (opt), date_to (opt), min_score (opt), page, size
- `AdminMatchRead`: Full match with both parties, score breakdown, timeline

**Knowledge Base**:
- `KnowledgeChunkListFilter`: language (opt), source (opt), page, size
- `KnowledgeIngestRequest`: content (str), source (str), language (si/en), metadata (dict)

**Analytics**:
- `MatchAnalytics`: matches_by_status (dict), avg_score, avg_fulfillment_time_days, top_crops_matched, matches_by_district
- `UserAnalytics`: registrations_by_day (list), active_users_by_day (list), users_by_role (dict), users_by_district (dict)
- `DiagnosisAnalytics`: diagnoses_by_day (list), top_classifications (list), avg_confidence, feedback_distribution (dict)

### 2. app/admin/service.py — AdminService

**Dashboard**:
- `get_dashboard_stats(db)` → Aggregate queries for all dashboard metrics. Use efficient count queries.

**User Management**:
- `list_users(db, filters)` → Paginated with search (ILIKE on name, email)
- `get_user_detail(db, user_id)` → Full user with activity stats
- `update_user(db, user_id, data)` → Admin can activate/deactivate, verify, change role
- `delete_user(db, user_id)` → Hard or soft delete with cascading cleanup

**Crop Taxonomy**:
- `list_crops(db, filters)` → All crops with pagination
- `create_crop(db, data)` → Add new crop to taxonomy
- `update_crop(db, crop_id, data)` → Edit crop details
- `toggle_crop(db, crop_id)` → Activate/deactivate

**Match Monitoring**:
- `list_matches(db, filters)` → All matches with both parties visible
- `get_match_detail(db, match_id)` → Full match with timeline
- `resolve_dispute(db, match_id, resolution, notes)` → Admin resolves disputed match
- `cancel_match(db, match_id, reason)` → Admin force-cancels a match

**Knowledge Base**:
- `list_knowledge_chunks(db, filters)` → Paginated chunks
- `ingest_knowledge(db, content, source, language, metadata)` → Chunk, embed, store
- `delete_knowledge_chunk(db, chunk_id)` → Remove chunk
- `get_knowledge_stats(db)` → Total chunks by language, source, recent additions

**Analytics**:
- `get_match_analytics(db, date_from, date_to)` → Match metrics
- `get_user_analytics(db, date_from, date_to)` → User growth metrics
- `get_diagnosis_analytics(db, date_from, date_to)` → Diagnosis metrics
- `get_system_health(db)` → DB connection count, Redis memory, last backup time

### 3. app/admin/router.py

All endpoints require `require_role("admin")`.

Prefix: `/api/v1/admin`

```
# Dashboard
GET    /admin/dashboard                     — Dashboard stats

# Users
GET    /admin/users                         — List users (paginated, filtered)
GET    /admin/users/{id}                    — User detail with activity
PUT    /admin/users/{id}                    — Update user (activate, verify, role)
DELETE /admin/users/{id}                    — Delete user

# Crop Taxonomy
GET    /admin/crops                         — List crops
POST   /admin/crops                         — Create crop
PUT    /admin/crops/{id}                    — Update crop
PATCH  /admin/crops/{id}/toggle             — Activate/deactivate

# Matches
GET    /admin/matches                       — List all matches
GET    /admin/matches/{id}                  — Match detail
POST   /admin/matches/{id}/resolve          — Resolve dispute
POST   /admin/matches/{id}/cancel           — Force cancel

# Knowledge Base
GET    /admin/knowledge                     — List chunks
POST   /admin/knowledge/ingest              — Ingest new content
DELETE /admin/knowledge/{id}                — Delete chunk
GET    /admin/knowledge/stats               — Knowledge base stats

# Analytics
GET    /admin/analytics/matches             — Match analytics
GET    /admin/analytics/users               — User analytics
GET    /admin/analytics/diagnoses           — Diagnosis analytics
GET    /admin/analytics/system              — System health

# Notifications (admin broadcast)
POST   /admin/notifications/broadcast       — Send notification to all users or filtered group
```

### 4. Register Router

Add admin router to main.py.

## Verification

1. All admin endpoints require admin role (403 for non-admin)
2. Dashboard stats return correct aggregates
3. User management: list, filter, search, activate/deactivate, verify
4. Crop taxonomy CRUD works
5. Match monitoring shows all matches with both parties
6. Dispute resolution changes match status
7. Knowledge base ingestion creates embedded chunks
8. Analytics return date-range filtered metrics
9. System health endpoint returns DB/Redis status

## Output Report
Write report to: `/home/claude/govihub-prompts/reports/REPORT_11_ADMIN.md`
