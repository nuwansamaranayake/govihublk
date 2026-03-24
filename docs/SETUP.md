# GoviHub — Full Setup Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Setup](#development-setup)
3. [Environment Variables](#environment-variables)
4. [Google OAuth Setup](#google-oauth-setup)
5. [Domain Configuration](#domain-configuration)
6. [Production Deployment](#production-deployment)
7. [Database Migrations](#database-migrations)
8. [Seed Data](#seed-data)
9. [SSL Setup](#ssl-setup)
10. [Monitoring](#monitoring)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Local Development

| Requirement | Minimum Version | Notes |
|-------------|----------------|-------|
| Docker | 24.0+ | Required for containerised services |
| Docker Compose | 2.20+ | Used for orchestration |
| Python | 3.11+ | For running API locally without Docker |
| Node.js | 18 LTS+ | For running frontend without Docker |
| Git | 2.40+ | Source control |

### Production VPS

| Requirement | Specification |
|-------------|--------------|
| OS | Ubuntu 22.04 LTS (recommended) |
| RAM | 4 GB minimum, 8 GB recommended |
| CPU | 2 vCPU minimum |
| Storage | 40 GB SSD + backup storage |
| Network | Static IPv4, SSH access |
| Firewall | Ports 22, 80, 443 open |

---

## Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-org/govihub.git
cd govihub
```

### 2. Create environment file

```bash
cp .env.example .env
```

Edit `.env` with your local values (see [Environment Variables](#environment-variables)).

### 3. Start all services

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts:
- **PostgreSQL 15** with PostGIS + pgvector extensions
- **Redis 7** for caching and task queues
- **govihub-api** (FastAPI on port 8000)
- **govihub-web** (Next.js on port 3000)

### 4. Run database migrations

```bash
docker compose -f docker-compose.dev.yml exec govihub-api alembic upgrade head
```

### 5. Seed initial data

```bash
# Seed crop taxonomy (required)
docker compose -f docker-compose.dev.yml exec govihub-api python scripts/seed_crops.py

# Seed knowledge base (for advisory RAG)
docker compose -f docker-compose.dev.yml exec govihub-api python scripts/seed_knowledge.py

# Seed market prices (optional)
docker compose -f docker-compose.dev.yml exec govihub-api python scripts/seed_prices.py

# Create admin account
docker compose -f docker-compose.dev.yml exec govihub-api python scripts/create_admin.py
```

### 6. Verify the setup

- API: http://localhost:8000/api/v1/health
- API Docs: http://localhost:8000/api/v1/docs
- Frontend: http://localhost:3000

### 7. Run tests

```bash
docker compose -f docker-compose.dev.yml exec govihub-api python -m pytest tests/ -v
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values:

### Required

```env
# Database
DATABASE_URL=postgresql+asyncpg://govihub:password@postgres:5432/govihub
DB_PASS=password

# Redis
REDIS_URL=redis://redis:6379/0

# JWT Authentication
JWT_SECRET_KEY=<generate with: openssl rand -hex 32>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# Google OAuth
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

# Application
APP_ENV=development
APP_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000

# MCP
MCP_ADMIN_SECRET=<generate with: openssl rand -hex 32>
```

### Optional (required for full functionality)

```env
# OpenRouter (for LLM advisory)
OPENROUTER_API_KEY=<from openrouter.ai>
OPENROUTER_MODEL=anthropic/claude-sonnet-4-20250514

# OpenWeather (for weather alerts)
OPENWEATHER_API_KEY=<from openweathermap.org>

# Cloudflare R2 (for image/media storage)
R2_ACCOUNT_ID=<Cloudflare account ID>
R2_ACCESS_KEY_ID=<R2 API token>
R2_SECRET_ACCESS_KEY=<R2 secret>
R2_BUCKET_NAME=govihub
R2_PUBLIC_URL=https://media.govihublk.com

# Firebase (for push notifications)
FCM_CREDENTIALS_PATH=/app/fcm-credentials.json

# Twilio (for SMS notifications)
TWILIO_ACCOUNT_SID=<Twilio SID>
TWILIO_AUTH_TOKEN=<Twilio auth token>
TWILIO_FROM_NUMBER=+1234567890
```

---

## Google OAuth Setup

1. **Create a Google Cloud Project**
   - Go to https://console.cloud.google.com
   - Create a new project: "GoviHub Production"

2. **Enable APIs**
   - Navigate to "APIs & Services" → "Enable APIs"
   - Enable "Google+ API" and "Google Identity"

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Application type: "Web application"

4. **Configure Authorized Redirect URIs**
   ```
   Development:
   http://localhost:3000/auth/callback
   http://localhost:8000/api/v1/auth/callback

   Production:
   https://govihublk.com/auth/callback
   https://govihub.lk/auth/callback
   ```

5. **Configure Authorized JavaScript Origins**
   ```
   Development: http://localhost:3000
   Production: https://govihublk.com, https://govihub.lk
   ```

6. **Copy credentials to `.env`**
   ```env
   GOOGLE_CLIENT_ID=<Your Client ID>.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=<Your Client Secret>
   ```

---

## Domain Configuration

### DNS Records (Hostinger/Cloudflare)

Add the following DNS records for your domain:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | `<VPS IP>` | 300 |
| A | www | `<VPS IP>` | 300 |
| CNAME | media | `<R2 bucket URL>` | 3600 |

For `govihub.lk` (secondary domain):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | `<VPS IP>` | 300 |
| A | www | `<VPS IP>` | 300 |

### Cloudflare Settings (if using Cloudflare proxy)

- SSL/TLS: Full (strict)
- Always Use HTTPS: On
- Automatic HTTPS Rewrites: On
- HSTS: Enable (max-age: 6 months, includeSubDomains)

---

## Production Deployment

### Initial Server Setup

```bash
# On VPS as root:

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy

# Install Docker Compose
apt-get install -y docker-compose-plugin

# Create deploy user
useradd -m -s /bin/bash deploy
mkdir -p /opt/govihub

# Copy SSH key
mkdir -p /home/deploy/.ssh
echo "<your-public-key>" >> /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### Deploy from CI/CD

```bash
# From your local machine or CI/CD:

export VPS_HOST=govihublk.com
export VPS_USER=deploy
export VPS_SSH_KEY=~/.ssh/govihub_deploy

bash scripts/deploy.sh
```

### First Deployment Steps

1. Copy `.env` to `/opt/govihub/.env` on VPS
2. Run `scripts/init-ssl.sh` to obtain SSL certificates
3. Run `scripts/deploy.sh` for initial deployment
4. Verify: `curl https://govihublk.com/api/v1/health`

---

## Database Migrations

### Create a new migration

```bash
docker compose exec govihub-api alembic revision --autogenerate -m "description"
```

### Apply migrations

```bash
# Upgrade to latest
docker compose exec govihub-api alembic upgrade head

# Upgrade to specific revision
docker compose exec govihub-api alembic upgrade <revision_id>

# Downgrade one step
docker compose exec govihub-api alembic downgrade -1

# View current state
docker compose exec govihub-api alembic current
```

---

## Seed Data

### Crop Taxonomy

```bash
docker compose exec govihub-api python scripts/seed_crops.py
```

Seeds ~50 Sri Lankan crops with Sinhala and Tamil names.

### Knowledge Base

```bash
docker compose exec govihub-api python scripts/seed_knowledge.py
```

Seeds agricultural advisory content for the RAG pipeline.

### Market Prices

```bash
docker compose exec govihub-api python scripts/seed_prices.py
```

Seeds sample market prices from Dambulla, Colombo, Kandy.

### Admin User

```bash
docker compose exec govihub-api python scripts/create_admin.py
# Follow prompts to set email and password
```

---

## SSL Setup

Run the initialization script once:

```bash
export ADMIN_EMAIL=admin@govihublk.com
bash scripts/init-ssl.sh
```

Certificates auto-renew via cron (configured by the script).

Manual renewal test:

```bash
docker run --rm \
  -v /opt/govihub/certbot/conf:/etc/letsencrypt \
  -v /opt/govihub/certbot/www:/var/www/certbot \
  certbot/certbot renew --dry-run
```

---

## Monitoring

### Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/health` | API health (no auth) |
| `GET /api/v1/admin/analytics/system` | System health stats (admin auth) |

### Log Access

```bash
# API logs
docker compose logs govihub-api --follow

# Nginx logs
docker compose logs nginx --follow

# All service logs
docker compose logs --follow
```

### Backup Status

```bash
ls -lh /opt/govihub/backups/
```

---

## Troubleshooting

### API not starting

```bash
docker compose logs govihub-api --tail=100
```

Common causes:
- Database not ready → wait for postgres health check
- `.env` file missing values → check required variables
- Port 8000 already in use → `lsof -i :8000`

### Database connection errors

```bash
# Check postgres is running
docker compose ps postgres

# Test connection
docker compose exec postgres psql -U govihub -d govihub -c "SELECT 1"
```

### SSL certificate issues

```bash
# Check certificate validity
docker run --rm \
  -v /opt/govihub/certbot/conf:/etc/letsencrypt \
  certbot/certbot certificates

# Force renewal
bash scripts/init-ssl.sh
```

### Out of disk space

```bash
# Check disk usage
df -h

# Clean Docker artifacts
docker system prune -a --volumes

# Old backups
find /opt/govihub/backups -name "*.sql.gz" -mtime +30 -delete
```
