# Prompt 01 — Project Scaffolding & Infrastructure Foundation

## Context
You are building GoviHub, an enterprise-grade AI-driven smart farming marketplace for Sri Lanka. This is the first prompt in a sequential build. You are starting from scratch.

## Objective
Create the complete project scaffolding: monorepo structure, Docker Compose configuration with persistent volumes, base FastAPI application, base Next.js application, Nginx config, and all configuration files. Nothing should be functional yet — this is pure skeleton and infrastructure.

## Instructions

### 1. Create the monorepo root

```
/home/claude/govihub/
```

Create a root `Makefile` with these targets:
- `make dev` — starts docker-compose.dev.yml (hot reload)
- `make prod` — starts docker-compose.yml
- `make down` — stops all containers
- `make logs` — tails all container logs
- `make migrate` — runs Alembic migrations inside the api container
- `make seed` — runs seed scripts inside the api container
- `make test` — runs pytest inside the api container
- `make shell-api` — opens bash in the api container
- `make shell-db` — opens psql in the postgres container
- `make backup` — runs pg_dump and compresses to ./backups/
- `make restore` — restores from latest backup

### 2. Backend Scaffolding (govihub-api/)

Create the FastAPI application skeleton:

**app/main.py**: FastAPI app factory with:
- CORS middleware (configurable origins from env)
- Request ID middleware (X-Request-ID header)
- Structured JSON logging middleware (log every request: method, path, status, duration_ms, request_id)
- Exception handlers (return consistent JSON error responses)
- Health check endpoint: `GET /api/v1/health` returns `{status: "healthy", version: "1.0.0", timestamp: ...}`
- Router includes for all modules (initially commented out, uncommented as modules are built)
- Lifespan handler for startup/shutdown (DB pool, Redis connection, ML model loading)

**app/config.py**: Pydantic Settings class loading from environment:
- All env vars from the master orchestrator's template
- Validation on required fields
- Computed properties (e.g., sync database URL for Alembic)

**app/database.py**: 
- Async SQLAlchemy engine and session factory
- `get_db` async generator dependency
- Base declarative model with `id` (UUID), `created_at`, `updated_at` as mixins
- Naming convention for constraints (for Alembic auto-naming)

**app/dependencies.py**:
- `get_db` — database session dependency
- `get_current_user` — placeholder (returns None, implemented in prompt 03)
- `get_current_active_user` — placeholder
- `require_role(*roles)` — placeholder role checker dependency factory
- `get_redis` — Redis connection dependency

**app/exceptions.py**: Custom exception classes:
- `GoviHubException(status_code, detail, error_code)`
- `NotFoundError`, `ForbiddenError`, `ValidationError`, `ExternalServiceError`
- Exception handler that formats all errors as: `{error: {code: str, message: str, details: any}}`

**app/utils/**: 
- `app/utils/__init__.py`
- `app/utils/pagination.py` — Generic pagination params (page, size, sort) and response wrapper `{data: [], meta: {page, size, total, pages}}`
- `app/utils/openrouter.py` — OpenRouter API client wrapper class. Must:
  - Use httpx async client
  - Support system + user messages
  - Handle rate limits with exponential backoff (3 retries)
  - Track token usage per request (log it)
  - Configurable model (default: `anthropic/claude-sonnet-4-20250514`)
  - Configurable max_tokens, temperature
  - Return structured response with `{content: str, usage: {input_tokens, output_tokens}, model: str}`
  - Error handling: raise `ExternalServiceError` on failure

Create empty module directories with `__init__.py`:
- `app/auth/`
- `app/users/`
- `app/listings/`
- `app/matching/`
- `app/diagnosis/`
- `app/advisory/`
- `app/marketplace/`
- `app/alerts/`
- `app/notifications/`
- `app/admin/`
- `app/mcp/`

**requirements.txt**: Pin all major versions:
```
fastapi>=0.110.0,<1.0
uvicorn[standard]>=0.27.0
gunicorn>=21.2.0
sqlalchemy[asyncio]>=2.0.25
asyncpg>=0.29.0
alembic>=1.13.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
httpx>=0.27.0
redis>=5.0.0
celery>=5.3.0
Pillow>=10.2.0
boto3>=1.34.0
python-multipart>=0.0.6
structlog>=24.1.0
orjson>=3.9.0
geoalchemy2>=0.14.0
pgvector>=0.2.0
sentence-transformers>=2.3.0
torch>=2.1.0
torchvision>=0.16.0
scikit-learn>=1.4.0
numpy>=1.26.0
firebase-admin>=6.3.0
twilio>=8.10.0
pytest>=8.0.0
pytest-asyncio>=0.23.0
httpx>=0.27.0
factory-boy>=3.3.0
authlib>=1.3.0
itsdangerous>=2.1.0
```

**Dockerfile** (multi-stage):
```dockerfile
# Build stage
FROM python:3.12-slim as builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Runtime stage
FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /install /usr/local
COPY . .
# Create non-root user
RUN adduser --disabled-password --gecos '' appuser
USER appuser
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--access-logfile", "-"]
```

**Alembic setup**:
- `alembic.ini` configured with async driver
- `migrations/env.py` that imports all models and uses async engine
- `migrations/versions/` (empty)

### 3. Frontend Scaffolding (govihub-web/)

Create a Next.js 14 app with App Router:

```bash
# Use these exact dependencies
next: 14.x
react: 18.x
tailwindcss: 3.4.x
next-intl: latest
next-pwa: latest (or @ducanh2912/next-pwa)
```

**Tailwind config** with GoviHub design tokens:
```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary: Green (agriculture, growth)
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#16a34a',  // Main green
          600: '#15803d',
          700: '#166534',
          800: '#14532d',
          900: '#052e16',
        },
        // Accent: Gold (harvest, prosperity)
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#d4a017',  // Main gold
          600: '#b8860b',
          700: '#92710c',
          800: '#78600d',
          900: '#614e12',
        },
        // Neutral: Slate (clean, modern - NO brown)
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        // Semantic
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
        info: '#2563eb',
      },
      fontFamily: {
        sans: ['Noto Sans Sinhala', 'Noto Sans Tamil', 'Inter', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

**next-intl setup**:
- `src/i18n.ts` — configuration
- `src/middleware.ts` — locale detection middleware (default: 'si', supported: ['si', 'en', 'ta'])
- `src/messages/en.json` — English strings (skeleton with common keys)
- `src/messages/si.json` — Sinhala strings (skeleton with placeholder `"[SI] key"` for now)
- `src/messages/ta.json` — Tamil strings (skeleton with placeholder `"[TA] key"` for now)

**App Router structure** (create directories and placeholder page.tsx files):
```
src/app/
├── [locale]/
│   ├── layout.tsx           # Root layout with i18n provider
│   ├── page.tsx             # Landing/home page
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── farmer/
│   │   ├── layout.tsx       # Farmer shell layout
│   │   ├── dashboard/page.tsx
│   │   ├── listings/page.tsx
│   │   ├── matches/page.tsx
│   │   ├── diagnosis/page.tsx
│   │   ├── advisory/page.tsx
│   │   └── marketplace/page.tsx
│   ├── buyer/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── demands/page.tsx
│   │   └── matches/page.tsx
│   ├── supplier/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   └── listings/page.tsx
│   └── admin/
│       ├── layout.tsx
│       └── dashboard/page.tsx
├── api/                     # Next.js API routes (auth callback only)
│   └── auth/
│       └── callback/route.ts
└── globals.css
```

Each placeholder page should render: `<div>Page: {pageName} — Under Construction</div>`

**Dockerfile** (multi-stage):
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

**Note**: For the pilot, we'll use Next.js standalone output mode (not static export) so we can use API routes for the Google OAuth callback. Configure `next.config.js` with `output: 'standalone'`.

### 4. Nginx Configuration

**nginx/conf.d/govihub.conf**:
```nginx
upstream govihub_api {
    server govihub-api:8000;
}

upstream govihub_web {
    server govihub-web:3000;
}

server {
    listen 80;
    server_name govihublk.com www.govihublk.com govihub.lk www.govihub.lk;
    
    # In production, redirect to HTTPS
    # For dev, proxy directly
    
    # API
    location /api/ {
        proxy_pass http://govihub_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        client_max_body_size 10M;
    }
    
    # MCP SSE endpoint
    location /mcp/ {
        proxy_pass http://govihub_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;
    }
    
    # Media/uploads
    location /media/ {
        proxy_pass http://govihub_api;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Frontend (everything else)
    location / {
        proxy_pass http://govihub_web;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api_general:10m rate=60r/m;
    limit_req_zone $binary_remote_addr zone=api_diagnosis:10m rate=30r/m;
    limit_req_zone $binary_remote_addr zone=api_auth:10m rate=10r/m;
}
```

### 5. Docker Compose Files

**docker-compose.yml** (production):
```yaml
version: '3.8'

services:
  nginx:
    image: nginx:1.24-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
    depends_on:
      - govihub-api
      - govihub-web
    restart: unless-stopped
    networks:
      - govihub-net

  govihub-api:
    build: ./govihub-api
    env_file: .env
    volumes:
      - ./ml/models:/app/ml/models:ro
      - ./uploads:/app/uploads
      - ./backups:/app/backups
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - govihub-net

  govihub-web:
    build: ./govihub-web
    env_file: .env.frontend
    depends_on:
      - govihub-api
    restart: unless-stopped
    networks:
      - govihub-net

  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: govihub
      POSTGRES_USER: govihub
      POSTGRES_PASSWORD: ${DB_PASS}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/01-init.sql:ro
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U govihub"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - govihub-net

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redisdata:/data
    ports:
      - "127.0.0.1:6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - govihub-net

volumes:
  pgdata:
    driver: local
  redisdata:
    driver: local

networks:
  govihub-net:
    driver: bridge
```

**docker-compose.dev.yml** (development override):
```yaml
version: '3.8'

services:
  govihub-api:
    build:
      context: ./govihub-api
      dockerfile: Dockerfile.dev
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    volumes:
      - ./govihub-api:/app
      - ./ml/models:/app/ml/models
    environment:
      - APP_ENV=development
      - APP_DEBUG=true
    ports:
      - "8000:8000"

  govihub-web:
    build:
      context: ./govihub-web
      dockerfile: Dockerfile.dev
    command: npm run dev
    volumes:
      - ./govihub-web:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    ports:
      - "3000:3000"

  postgres:
    ports:
      - "5432:5432"

  redis:
    ports:
      - "6379:6379"
```

Create `govihub-api/Dockerfile.dev`:
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

Create `govihub-web/Dockerfile.dev`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]
```

### 6. Database Initialization

**init-db.sql**:
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create second database for Drapestudio co-location
-- (GoviHub uses 'govihub' database created by POSTGRES_DB env)
```

### 7. Root Config Files

**.env.example** — copy of all env vars with placeholder values
**.gitignore** — comprehensive Python + Node + Docker gitignore
**README.md** — project overview with setup instructions

## Verification

After completing all steps, verify:

1. `ls -la /home/claude/govihub/` shows all expected directories
2. `cat /home/claude/govihub/govihub-api/app/main.py` contains a valid FastAPI app
3. `cat /home/claude/govihub/govihub-api/app/config.py` contains Pydantic Settings
4. `cat /home/claude/govihub/docker-compose.yml` is valid YAML with all services
5. `ls /home/claude/govihub/govihub-web/src/app/` shows locale-based routing
6. `cat /home/claude/govihub/govihub-web/tailwind.config.js` has green/gold theme
7. All `__init__.py` files exist in module directories
8. `cat /home/claude/govihub/govihub-api/app/utils/openrouter.py` has the OpenRouter client
9. Count total files created — should be 50+

## Output Report
Write report to: `/home/claude/govihub-prompts/reports/REPORT_01_SCAFFOLDING.md`
