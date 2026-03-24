# GoviHub — Master Build Orchestrator

## Purpose
This is the master prompt that instructs Claude Code to execute each build prompt sequentially, generating a report after each step. Run this file to build the entire GoviHub platform from scratch.

## Project Overview
GoviHub is an AI-driven smart farming marketplace for Sri Lanka. It connects farmers, buyers, and suppliers through intelligent harvest-demand matching, crop disease diagnosis, RAG-based agricultural advisory, and weather/price alerts. The platform is trilingual (English, Sinhala, Tamil), mobile-first, and deployed as Docker containers on a Hostinger VPS.

## Critical Architectural Decisions

### Deviations from Original Architecture (per stakeholder direction)
1. **Authentication**: Google OAuth (not phone OTP). All Sri Lankan users have Google accounts via Android devices. Retain phone field for SMS notifications but authentication is Google-only.
2. **LLM Provider**: OpenRouter API with `anthropic/claude-sonnet-4.6` (not direct Anthropic API). This minimizes cost for the free pilot. All LLM calls go through OpenRouter.
3. **MCP Endpoints**: The backend exposes MCP (Model Context Protocol) SSE endpoints for admin-only data retrieval. Farmers, buyers, and suppliers have NO access to MCP connectors. MCP enables Claude or other AI systems to query GoviHub data.
4. **Theme**: Green and Gold (Sri Lanka agriculture colors). No brown anywhere. Modern, clean, mobile-first.
5. **Translations**: English and Sinhala in Phase 1. Tamil placeholder structure ready. Sinhala must be accurate — translations will be verified via Gemini.

### Non-Negotiable Requirements
- **SOLID principles**: Every module must be independently extensible. New features = new code, not modified existing code.
- **API-first**: Every backend capability exposed as a versioned REST endpoint under `/api/v1/`.
- **Docker with persistent data**: PostgreSQL and Redis data on host-mounted volumes. Container rebuilds must NOT destroy data.
- **Admin backend**: Full platform management (users, crops, matches, disputes, analytics).
- **Mobile-first PWA**: Primary UX is smartphone. Desktop is secondary.
- **Enterprise-grade**: This will become Sri Lanka's most important agriculture app. Code quality, error handling, logging, and security must reflect that.

## Execution Instructions

Execute each prompt file in order (01 through 15). After each prompt:

1. Execute ALL instructions in the prompt file completely.
2. Run any verification/test commands specified in the prompt.
3. Generate a status report in `/home/claude/govihub-prompts/reports/` named `REPORT_XX_<name>.md` containing:
   - What was built
   - Files created/modified (list)
   - Tests run and results
   - Any issues encountered and how they were resolved
   - Ready/Not-Ready status for next prompt
4. Only proceed to the next prompt if the current one passes all verifications.
5. If a prompt fails, document the failure in the report and STOP. Do not proceed.

## Directory Structure

```
/home/claude/govihub/
├── govihub-api/               # FastAPI backend
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   ├── auth/
│   │   ├── users/
│   │   ├── listings/
│   │   ├── matching/
│   │   ├── diagnosis/
│   │   ├── advisory/
│   │   ├── marketplace/
│   │   ├── alerts/
│   │   ├── notifications/
│   │   ├── admin/
│   │   └── mcp/               # MCP SSE endpoints (admin only)
│   ├── migrations/
│   ├── scripts/
│   ├── ml/
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── govihub-web/               # Next.js 14 PWA frontend
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── messages/
│   ├── public/
│   ├── next.config.js
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   └── conf.d/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
└── Makefile
```

## Prompt Execution Order

| # | Prompt File | What It Builds | Estimated Scope |
|---|-------------|---------------|-----------------|
| 01 | Project Scaffolding | Monorepo, Docker, DB, configs | Foundation |
| 02 | Database & Migrations | All 11+ tables, Alembic, seeds | Data layer |
| 03 | Auth Module | Google OAuth, JWT, RBAC middleware | Security |
| 04 | User & Profile Module | Registration, profiles, preferences | Core entity |
| 05 | Listings Module | Harvest CRUD, Demand CRUD, lifecycle | Core business |
| 06 | Matching Engine | Scoring algorithm, background jobs, notifications | Core AI |
| 07 | Diagnosis Module | Image upload, CNN placeholder, OpenRouter advisory | AI service |
| 08 | Advisory RAG Module | Embeddings, vector search, OpenRouter generation | AI service |
| 09 | Marketplace & Alerts | Supply listings, weather, price feeds | Support |
| 10 | Notifications Module | FCM, SMS, in-app, preferences | Infrastructure |
| 11 | Admin Module | Dashboard, CRUD, analytics, moderation | Admin |
| 12 | MCP Endpoints | SSE server, admin-only tools, data retrieval | Integration |
| 13 | Frontend Foundation | Next.js, i18n, auth, design system, routing | UI foundation |
| 14 | Frontend Features | All role views, forms, dashboards, camera | UI features |
| 15 | Integration & Deploy | Docker compose, nginx, testing, deploy scripts | Ship it |

## Environment Variables Template

```env
# Database
DATABASE_URL=postgresql+asyncpg://govihub:${DB_PASS}@postgres:5432/govihub
DB_PASS=<generate-strong-password>

# Redis
REDIS_URL=redis://redis:6379/0

# Auth (Google OAuth)
GOOGLE_CLIENT_ID=<from-google-cloud-console>
GOOGLE_CLIENT_SECRET=<from-google-cloud-console>
JWT_SECRET_KEY=<generate-256-bit-key>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# LLM (OpenRouter)
OPENROUTER_API_KEY=<from-openrouter>
OPENROUTER_MODEL=anthropic/claude-sonnet-4-20250514
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# External APIs
OPENWEATHER_API_KEY=<from-openweathermap>

# Object Storage (Cloudflare R2)
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret>
R2_BUCKET_NAME=govihub
R2_PUBLIC_URL=https://media.govihublk.com

# FCM (Firebase Cloud Messaging)
FCM_CREDENTIALS_PATH=/app/fcm-credentials.json

# SMS (Twilio or local gateway)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=<twilio-sid>
TWILIO_AUTH_TOKEN=<twilio-token>
TWILIO_FROM_NUMBER=+1234567890

# App
APP_NAME=GoviHub
APP_ENV=production
APP_DEBUG=false
APP_URL=https://govihublk.com
ALLOWED_ORIGINS=https://govihublk.com,https://govihub.lk

# MCP
MCP_ADMIN_SECRET=<generate-strong-secret>
```

## Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | FastAPI + Gunicorn/Uvicorn | 0.110+ |
| ORM | SQLAlchemy (async) + Alembic | 2.0+ |
| Database | PostgreSQL + PostGIS + pgvector | 16 |
| Cache/Queue | Redis | 7 |
| Frontend | Next.js (App Router) | 14 |
| UI Framework | Tailwind CSS | 3.4+ |
| i18n | next-intl | latest |
| Auth | Google OAuth 2.0 + JWT | - |
| LLM | OpenRouter (Sonnet 4) | - |
| Embeddings | sentence-transformers (MiniLM-L12) | - |
| CNN | EfficientNet-Lite0 (PyTorch) | - |
| Container | Docker Compose | 3.8 |
| Reverse Proxy | Nginx | 1.24 |
| CDN | Cloudflare | - |
| Object Storage | Cloudflare R2 | - |

---
*Begin execution with prompt 01_PROJECT_SCAFFOLDING.md*
