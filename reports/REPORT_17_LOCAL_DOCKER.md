# Prompt 17 — Local Docker Development Setup

**Date:** 2026-03-24
**Status:** COMPLETE
**Tag:** v1.0.0-rc1 → v1.1.0-dev-setup

---

## Summary

Set up a complete local Docker development environment for GoviHub, enabling the full stack to run locally without any production credentials or external services.

## Files Created / Modified

### New Files (6)
| File | Purpose |
|------|---------|
| `.env` | Local dev environment variables (dev-safe defaults) |
| `govihub-api/app/auth/dev_router.py` | Dev-only auth bypass — login as any role without Google OAuth |
| `govihub-web/src/app/[locale]/auth/dev-login/page.tsx` | Frontend dev login page with 4 role buttons |
| `scripts/local-setup.sh` | One-shot setup script: build, start, wait, migrate, seed |
| `scripts/test-api.sh` | API smoke test: exercises all major endpoints with curl |
| `reports/REPORT_17_LOCAL_DOCKER.md` | This report |

### Modified Files (4)
| File | Change |
|------|--------|
| `.env.frontend` | Updated for local dev (localhost URLs) |
| `docker-compose.dev.yml` | Full standalone rewrite: healthchecks, env_file, volumes, networks |
| `govihub-api/app/main.py` | Registers dev auth router when `APP_ENV=development` |
| `govihub-api/app/config.py` | Added `DATABASE_URL_SYNC` field, improved `sync_database_url` property |
| `Makefile` | Added 11 local-* targets for dev workflow |

## Architecture Decisions

### 1. Dev Auth Bypass
- **Why:** Google OAuth requires real credentials + consent screen configuration. For local testing this is a blocker.
- **How:** `dev_router.py` provides `POST /api/v1/auth/dev/login/{role}` which auto-creates test users and returns JWT tokens.
- **Safety:** Guarded by `if settings.APP_ENV != "development"` — raises 403 in production.
- **Users:** farmer@test.govihub.lk, buyer@test.govihub.lk, supplier@test.govihub.lk, admin@test.govihub.lk

### 2. Standalone docker-compose.dev.yml
- **Why:** The original dev compose was a thin override requiring the base compose. For local dev we need a self-contained file.
- **How:** Full service definitions with healthchecks, env_file references, named volumes (`pgdata_dev`, `redisdata_dev`), and a dedicated `govihub-net` network.

### 3. Empty Credentials = Graceful Fallback
- All external service keys (OpenRouter, OpenWeather, R2, FCM, Twilio) default to empty strings. The application should gracefully skip or mock these features when keys are absent.

## How to Use

```bash
# First time setup
make local-setup

# Or step by step:
docker compose -f docker-compose.dev.yml up -d
# Wait for healthy...
# Run migrations...

# Daily development
make local-up        # Start containers
make local-down      # Stop containers
make local-restart   # Restart API + Web
make local-logs-api  # Tail API logs
make local-psql      # PostgreSQL shell
make local-test-api  # Run smoke tests

# Fresh start (wipe DB)
make local-fresh
```

## Dev Login

**Browser:** http://localhost:6001/en/auth/dev-login

**curl:**
```bash
# Get token
curl -s -X POST http://localhost:8000/api/v1/auth/dev/login/farmer | python3 -m json.tool

# Use token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/dev/login/farmer | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/users/me | python3 -m json.tool
```

## Verification Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | `curl http://localhost:8000/api/v1/health` | `{"status": "healthy"}` |
| 2 | `curl http://localhost:6001` | HTML response |
| 3 | `POST /api/v1/auth/dev/login/farmer` | JWT token + user object |
| 4 | Browser: `/en/auth/dev-login` | 4 role buttons |
| 5 | Click "Farmer" | Redirects to farmer dashboard |
| 6 | `make local-test-api` | All checks pass |
| 7 | `SELECT count(*) FROM crop_taxonomy` | 35 crops |
| 8 | API docs at `/api/v1/docs` | Swagger UI |

## Security Notes

- `.env` is in `.gitignore` — will not be committed
- Dev auth endpoints return 403 when `APP_ENV != development`
- JWT secret is a placeholder — must be changed for production
- No real credentials are stored in any committed file
