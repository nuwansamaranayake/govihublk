# GoviHub — CLAUDE.md

## Your Role

You are the hands-on technical lead for GoviHub. The human is the manager — they make decisions, you execute everything. They do NOT run commands, edit files, manage Docker, debug issues, or deploy. You do all of that autonomously. When something breaks, you diagnose and fix it. When something needs building, you build it. When something needs deploying, you deploy it. Report back with results, not instructions.

This applies to ALL projects, not just GoviHub.

## Project

- **Name:** GoviHub
- **Domain:** GoviHubLk.com (future: govihub.lk)
- **What:** AI-driven smart farming marketplace for Sri Lanka
- **Pilot:** Anuradhapura & Polonnaruwa (North Central Province, dry zone)
- **Stack:** FastAPI backend, Next.js 14 PWA frontend, PostgreSQL 16 + PostGIS + pgvector, Redis 7
- **Path:** `E:\AiGNITE\projects\GoviHub`
- **Logo:** Circular mark (paddy stalk + network nodes), green + gold, no brown

## Local Docker Environment

### Compose file

`docker-compose.dev.yml`

### Services & Ports

| Service | Port | Health |
|---------|------|--------|
| govihub-api (FastAPI) | 8002 | `GET /api/v1/health` |
| govihub-web (Next.js) | 6000 | HTTP response |
| postgres (PostGIS 16) | 5434 | `pg_isready` |
| redis (Redis 7) | 6380 | `redis-cli ping` |

### URLs

| What | URL |
|------|-----|
| Frontend | http://localhost:6000 |
| Dev Login | http://localhost:6000/en/auth/dev-login |
| API | http://localhost:8002 |
| Swagger Docs | http://localhost:8002/docs |
| Health | http://localhost:8002/api/v1/health |

### Database (local dev only)

```
Host: localhost:5434 | DB: govihub | User: govihub | Pass: govihub_dev_2026
```

### Environment

- `.env` — backend (empty API keys = mock mode)
- `.env.frontend` — frontend (NEXT_PUBLIC_API_URL, etc.)

## How to Operate

### Start (full setup from scratch)

```bash
cd E:\AiGNITE\projects\GoviHub
docker compose -f docker-compose.dev.yml up -d --build
# Wait for postgres health, then:
docker compose -f docker-compose.dev.yml exec govihub-api alembic upgrade head
docker compose -f docker-compose.dev.yml exec govihub-api python scripts/seed_crops.py
docker compose -f docker-compose.dev.yml exec govihub-api python scripts/seed_prices.py
docker compose -f docker-compose.dev.yml exec govihub-api python scripts/seed_knowledge.py
```

### Quick start (already built)

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Stop

```bash
docker compose -f docker-compose.dev.yml down
```

### Nuke and fresh start

```bash
docker compose -f docker-compose.dev.yml down -v
# Then do the full setup again
```

### Restart API/Web only (preserves DB)

```bash
docker compose -f docker-compose.dev.yml restart govihub-api govihub-web
```

### Rebuild after dependency change

```bash
docker compose -f docker-compose.dev.yml up -d --build govihub-api   # requirements.txt changed
docker compose -f docker-compose.dev.yml up -d --build govihub-web   # package.json changed
```

### Logs

```bash
docker compose -f docker-compose.dev.yml logs -f govihub-api         # API
docker compose -f docker-compose.dev.yml logs -f govihub-web          # Frontend
docker compose -f docker-compose.dev.yml logs -f postgres             # Database
docker compose -f docker-compose.dev.yml logs --tail=100 govihub-api  # Last 100 lines
```

### Database

```bash
docker compose -f docker-compose.dev.yml exec postgres psql -U govihub -d govihub
```

### Migrations

```bash
docker compose -f docker-compose.dev.yml exec govihub-api alembic upgrade head
docker compose -f docker-compose.dev.yml exec govihub-api alembic revision --autogenerate -m "description"
```

### Tests

```bash
docker compose -f docker-compose.dev.yml exec govihub-api pytest tests/ -v
bash scripts/test-api.sh
```

### Dev Auth (no Google OAuth needed)

```bash
curl -s -X POST http://localhost:8002/api/v1/auth/dev/login/farmer
curl -s -X POST http://localhost:8002/api/v1/auth/dev/login/buyer
curl -s -X POST http://localhost:8002/api/v1/auth/dev/login/supplier
curl -s -X POST http://localhost:8002/api/v1/auth/dev/login/admin
```

### Hot Reload

- **Backend:** edit `govihub-api/app/**/*.py` → auto-reloads (Uvicorn watch)
- **Frontend:** edit `govihub-web/src/**/*` → auto-reloads (Next.js HMR)
- No restart needed for code changes. Only rebuild for dependency changes.

## When Things Break — Diagnosis Order

1. `docker compose -f docker-compose.dev.yml ps` — are all containers running?
2. `docker compose -f docker-compose.dev.yml logs --tail=50 <service>` — what's the error?
3. Health check: `curl -s http://localhost:8002/api/v1/health`
4. DB connection: `docker compose -f docker-compose.dev.yml exec postgres pg_isready -U govihub`
5. Redis: `docker compose -f docker-compose.dev.yml exec redis redis-cli ping`
6. If DB migration issue: `docker compose -f docker-compose.dev.yml exec govihub-api alembic current`
7. Nuclear: `docker compose -f docker-compose.dev.yml down -v` then full rebuild

## Standing Orders

- When the manager says "start" / "bring it up" → start the dev environment, verify health, report URLs
- When they say "stop" / "shut it down" → stop all containers
- When they say "restart" → restart API + web, verify health
- When they say "fresh start" / "nuke" → down -v, rebuild, migrate, seed, verify
- When they say "logs" → tail API logs unless they specify another service
- When they say "status" → check all 4 services, report health
- When they say "test" → run smoke tests, report pass/fail
- When they report a bug → diagnose autonomously (logs → code → fix → verify)
- When they ask for a feature → implement it, migrate if needed, verify it works
- When they ask for deployment → execute deploy script, verify health
- **NEVER give the manager commands to run. Execute them yourself and report the result.**
- Always `cd E:\AiGNITE\projects\GoviHub` before running any command
