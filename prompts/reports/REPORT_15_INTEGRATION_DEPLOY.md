# Prompt 15 Report — Integration Testing, Deployment & Production Readiness

**Date:** 2026-03-23
**Prompt:** 15 — Integration Testing, Deployment & Production Readiness
**Status:** Complete

---

## Summary

All files for production readiness, integration testing, and deployment have been created. This prompt establishes the final layer needed to go from a working codebase to a deployable, monitored, and tested production system.

---

## Files Created

### Backend Tests (`govihub-api/tests/`)

| File | Tests | Coverage |
|------|-------|----------|
| `tests/conftest.py` | Fixtures | Session-scoped engine, transactional sessions, factory fixtures for all 4 roles + crop/listing/demand/match/supply/notification, JWT fixtures, mocks for OpenRouter/OpenWeather/FCM/SMS/embedding/CNN |
| `tests/test_auth.py` | 12 tests | JWT creation, all roles, no-role token, jti uniqueness, exp/iat ordering, expired 401, invalid 401, wrong-secret 401, hash determinism, SHA-256 length, hash uniqueness, avalanche effect |
| `tests/test_users.py` | 11 tests | Get own profile (3 roles), unauthenticated 401, update name, update language, update farmer profile, admin forbidden for farmer/buyer, admin access, UserRole enum, User model creation |
| `tests/test_listings.py` | 11 tests | Create harvest (farmer), buyer forbidden, list harvests, get by ID, update own, ownership enforcement, create demand (buyer), farmer forbidden, delete demand, listing status enum, demand status enum |
| `tests/test_matching.py` | 12 tests | Perfect match score, zero distance score 1.0, max distance score 0.0, no geo neutral 0.5, quantity mismatch penalty, freshness decay, expired date overlap 0, weights sum to 1.0, score bounds, list matches (farmer), get match detail, unauthenticated 401 |
| `tests/test_diagnosis.py` | 10 tests | CLASS_NAMES count (38), includes rice diseases, includes tomato diseases, placeholder returns top-3, confidence keys, sum check, placeholder mode delegation, confidence ordering, unauthenticated 401, no-file 422, valid JPEG, PNG, invalid type 4xx |
| `tests/test_advisory.py` | 8 tests | Embedding dimension, different texts, not all-zeros, unauthenticated 401, non-farmer role, ask with mock LLM, Sinhala language, empty history, missing question 422 |
| `tests/test_marketplace.py` | 11 tests | Create supply (supplier), farmer forbidden, buyer forbidden, list public, list authenticated, search by category, get by ID, update own, delete own, SupplyCategory enum, SupplyStatus enum |
| `tests/test_admin.py` | 11 tests | No auth 401, farmer 403, buyer 403, supplier 403, admin accessible, list users, filter by role, list crops, create crop, analytics matches, analytics users, system health |
| `tests/test_mcp.py` | 14 tests | 401 error attributes, 403 error attributes, missing header 401, wrong secret 403, correct secret passes, malformed header 401, rpc_result structure, rpc_error structure, rpc_error with data, handle_initialize, handle_tools_list, tool definitions have required fields, handlers match definitions, messages without auth 401, wrong secret 403, session not found 404 |
| `tests/test_notifications.py` | 9 tests | NotificationType enum, NotificationChannel enum, Notification model creation, list requires auth, list authenticated, unread count, mark read, mark all read, get preferences, update preferences, cannot read others' notification |

**Total backend tests: ~109 test cases across 10 files**

### Deployment Scripts (`scripts/`)

| File | Purpose |
|------|---------|
| `scripts/build-test.sh` | Full CI pipeline: builds Docker images, starts PostgreSQL+Redis, waits for health, runs Alembic migrations, seeds data, starts application services, runs pytest suite. Supports `--skip-build`, `--skip-seed`, `--filter`, `--keep-running` flags. |
| `scripts/deploy.sh` | Production VPS deploy via rsync: pre-deploy backup, rsync code, build images on VPS, apply migrations, rolling restart (API → web → nginx), health verification with auto-rollback, cleanup dangling images. |
| `scripts/rollback.sh` | Restore from backup: stop services, restore PostgreSQL from `.sql.gz` (local or R2), restart with previous Docker images, verify health. Supports `--tag`, `--file`, `--list`. |
| `scripts/backup.sh` | PostgreSQL dump + gzip + Cloudflare R2 upload + retention cleanup (30 days local, 90 days R2). Writes `.meta.json` alongside each backup. |
| `scripts/init-ssl.sh` | Let's Encrypt Certbot setup: validates DNS, creates directories, starts Nginx for ACME challenge, runs certbot with webroot method, sets up auto-renewal cron (twice daily). |
| `scripts/scheduler.py` | APScheduler (AsyncIOScheduler) with 6 jobs: weather alerts (hourly at :05), market prices (daily 00:30 UTC = 06:00 IST), database backup (daily 20:30 UTC = 02:00 IST), expire listings (daily 21:30 UTC = 03:00 IST), expire matches (daily 22:00 UTC), cleanup old notifications (weekly Saturday 22:30 UTC = Sunday 04:00 IST). Handles SIGTERM/SIGINT gracefully. |

All shell scripts have `chmod +x` applied.

### Nginx Production Config (`nginx/conf.d/govihub.conf`)

Replaced the basic HTTP-only config with full production config:

- **HTTP → HTTPS redirect** with ACME challenge passthrough (`/.well-known/acme-challenge/`)
- **SSL configuration**: TLS 1.2/1.3 only, modern cipher suite, OCSP stapling, session caching
- **Security headers**: X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, X-XSS-Protection, Referrer-Policy, HSTS (2 years + includeSubDomains + preload), Permissions-Policy, Content Security Policy
- **Rate limiting zones**: `api_general` (60/min), `api_auth` (10/min), `api_diagnosis` (30/min), `api_advisory` (20/min)
- **SSE config for MCP**: `proxy_buffering off`, `chunked_transfer_encoding off`, 3600s read/send timeout, `X-Accel-Buffering: no`
- **Gzip**: enabled for JSON, JS, CSS, SVG, fonts, min 1000 bytes
- **Static asset caching**: `/_next/static/` → 1 year immutable, `/_next/image` → 30 days, icons/images → 30 days
- **Upstream keepalive**: 32 connections to API, 16 to web
- `server_tokens off`

### Documentation (`docs/`)

| File | Contents |
|------|---------|
| `docs/SETUP.md` | Prerequisites (local + VPS), dev setup (6 steps with commands), full environment variable reference (required + optional), Google OAuth setup (5 steps), DNS configuration table, production deployment guide, database migrations reference, seed data commands, SSL setup, monitoring endpoints, troubleshooting guide |
| `docs/PRODUCTION_CHECKLIST.md` | 8 sections: Security (26 items), Infrastructure (15 items), Data (12 items), Monitoring (13 items), Testing (16 items), Performance (13 items), External Services (16 items), Documentation & Handoff (10 items). Sign-off table with Go/No-Go decision. **~121 checklist items total.** |

### Requirements Update (`govihub-api/requirements.txt`)

Added:
- `apscheduler>=3.10.0` — for the scheduler process
- `pytest-httpx>=0.30.0` — for async HTTP client mocking in tests
- `aiosqlite>=0.19.0` — SQLite async driver for in-memory test database

### Frontend Tests (`govihub-web/__tests__/`)

| File | Tests | Coverage |
|------|-------|----------|
| `__tests__/components.test.tsx` | 22 tests | Button (renders, onClick, disabled, loading, no click when disabled, fullWidth, variants), Badge (renders, dot, no-dot default, color attribute, default color), Card (renders, header, footer, no header when absent, button when onClick, div otherwise), Input (renders, label, error+aria-invalid, no error default, disabled, onChange, placeholder) |
| `__tests__/api-client.test.ts` | 22 tests | Initial null token, set token, clear token, Authorization header included/excluded, GET returns JSON, POST sends body, PATCH, DELETE, 204 returns undefined, credentials:include, 400 throws ApiException, 404 with status, detail field, message field, non-JSON body, auto-refresh on 401 (retry success), 401 when refresh fails, token cleared on failed refresh, FormData no Content-Type |

**Total frontend tests: 44 test cases across 2 files**

---

## Architecture Notes

### Test Strategy

The backend test suite uses a **SQLite in-memory database** via `aiosqlite` for fast, isolated unit/integration tests that do not require a running PostgreSQL instance. This makes tests runnable in CI without Docker.

The `conftest.py` uses **transactional isolation** — each test gets a fresh session that rolls back at the end, ensuring test isolation without table truncation overhead.

External services (OpenRouter, OpenWeather, FCM, SMS, embedding model, CNN) are **mocked via pytest fixtures** using `unittest.mock.patch`, so tests are deterministic and fast.

### Scheduler Design

The scheduler runs as a **separate process** (`python scripts/scheduler.py`) rather than inside the API process, allowing independent scaling and failure isolation. It uses `AsyncIOScheduler` (not the blocking variant) to support async database operations natively.

### Deployment Safety

The deploy script implements **automatic rollback on health check failure** — if the production API does not pass health checks within the timeout, it calls `rollback.sh` to restore the previous backup. The `--no-rollback` flag disables this for manual deployments where rollback is not desired.

---

## Testing Gaps and Considerations

1. **Frontend tests** require `jest`, `@testing-library/react`, and `@testing-library/jest-dom` to be installed. These are not yet in `package.json` devDependencies (pending Prompt 16 or manual addition).

2. **Backend database tests** against SQLite will not exercise PostGIS or pgvector functionality. Full integration tests for spatial matching and embedding search require a live PostgreSQL instance (available in `build-test.sh`).

3. **CNN model tests** run in placeholder mode since the `.pt` model file is not present in CI. Real inference tests require the trained model.

4. **MCP SSE tests** do not test the full streaming pipeline since that requires a real WebSocket/SSE connection. The HTTP message endpoint and auth are tested instead.
