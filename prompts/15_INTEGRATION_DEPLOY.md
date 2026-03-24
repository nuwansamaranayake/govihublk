# Prompt 15 — Integration Testing, Deployment & Production Readiness

## Context
All backend modules and frontend pages are built. Now wire everything together, write tests, configure deployment, and ensure production readiness.

## Objective
End-to-end integration testing, Docker production build verification, deployment scripts, backup automation, monitoring setup, and final production hardening.

## Instructions

### 1. Backend Integration Tests (govihub-api/tests/)

Create a comprehensive test suite. Use pytest-asyncio with an in-memory or test database.

**tests/conftest.py**:
- Create test database fixtures (async SQLAlchemy session with test DB)
- Create test client (httpx AsyncClient with FastAPI TestClient)
- Factory fixtures for creating test users, listings, demands, matches
- Mock fixtures for OpenRouter, OpenWeather, FCM, SMS
- Auth fixtures: generate valid JWT tokens for test users

**tests/test_auth.py**:
- Test Google OAuth code exchange (mock Google API)
- Test JWT token creation and validation
- Test token refresh flow
- Test logout and token revocation
- Test expired token returns 401
- Test invalid token returns 401

**tests/test_users.py**:
- Test complete registration (farmer, buyer, supplier)
- Test duplicate registration fails
- Test profile update
- Test location update with PostGIS
- Test role-based access (farmer can't access buyer endpoints)
- Test public profile hides sensitive data

**tests/test_listings.py**:
- Test harvest listing CRUD (create, read, update, delete)
- Test demand posting CRUD
- Test status transitions (valid and invalid)
- Test ownership enforcement (user A can't edit user B's listing)
- Test pagination and filtering
- Test geospatial browse (within radius)
- Test date validation (future dates only)

**tests/test_matching.py**:
- Test matching engine scoring with known inputs:
  - Create harvest and demand with same crop, overlapping dates, nearby locations
  - Verify match score > 0.5
  - Verify score breakdown components
- Test hard filter exclusion:
  - Different crops → no match
  - Non-overlapping dates → no match
  - Out of radius → no match
- Test match lifecycle:
  - proposed → farmer_accepted → buyer_accepted → confirmed → fulfilled
- Test invalid transitions return 400
- Test farmer cluster suggestion when single farmer insufficient

**tests/test_diagnosis.py**:
- Test image upload (valid JPEG)
- Test invalid file type rejection
- Test CNN prediction returns top-3
- Test confidence routing thresholds
- Test OpenRouter advice generation (mock)
- Test diagnosis history pagination
- Test feedback submission

**tests/test_advisory.py**:
- Test question embedding generates 384-dim vector
- Test pgvector similarity search returns chunks
- Test OpenRouter answer generation (mock)
- Test Sinhala and English language handling
- Test advisory history

**tests/test_marketplace.py**:
- Test supply listing CRUD
- Test proximity search
- Test category filtering
- Test keyword search

**tests/test_admin.py**:
- Test admin-only access enforcement
- Test dashboard stats aggregation
- Test user management (list, filter, activate, deactivate)
- Test crop taxonomy CRUD
- Test match monitoring and dispute resolution
- Test knowledge base ingestion

**tests/test_mcp.py**:
- Test MCP auth (valid admin secret accepted)
- Test MCP auth (regular user JWT rejected)
- Test MCP auth (invalid token rejected)
- Test tools/list returns all tools
- Test each tool handler returns valid data
- Test rate limiting (document, don't enforce in test)

**tests/test_notifications.py**:
- Test notification creation
- Test mark read (single and batch)
- Test unread count
- Test preference management
- Test FCM dispatch (mock)
- Test SMS dispatch (mock)
- Test quiet hours enforcement

### 2. Frontend Tests

**Basic smoke tests** using Next.js testing:

Create `govihub-web/__tests__/` with:
- `components.test.tsx`: Test all UI components render without errors
- `api-client.test.ts`: Test API client handles auth, refresh, errors
- `i18n.test.ts`: Test translations load for all locales
- `auth.test.tsx`: Test login page renders, Google OAuth redirect

### 3. Docker Production Build Verification

**Build and test all containers**:

```bash
#!/bin/bash
# scripts/build-test.sh

echo "=== Building all Docker images ==="
docker-compose build --no-cache

echo "=== Starting services ==="
docker-compose up -d

echo "=== Waiting for health checks ==="
sleep 30

echo "=== Testing API health ==="
curl -f http://localhost:8000/api/v1/health || exit 1

echo "=== Testing frontend ==="
curl -f http://localhost:3000 || exit 1

echo "=== Testing nginx proxy ==="
curl -f http://localhost/api/v1/health || exit 1

echo "=== Running migrations ==="
docker-compose exec govihub-api alembic upgrade head || exit 1

echo "=== Running seeds ==="
docker-compose exec govihub-api python scripts/seed_crops.py || exit 1
docker-compose exec govihub-api python scripts/seed_prices.py || exit 1

echo "=== Running backend tests ==="
docker-compose exec govihub-api pytest tests/ -v --tb=short || exit 1

echo "=== All checks passed ==="
docker-compose down
```

### 4. Deployment Scripts

**scripts/deploy.sh** — Production deployment to Hostinger VPS:
```bash
#!/bin/bash
set -euo pipefail

DEPLOY_USER="root"
DEPLOY_HOST="govihublk.com"  # or IP
DEPLOY_DIR="/opt/govihub"
BACKUP_DIR="/opt/govihub-backups"

echo "=== GoviHub Deployment ==="
echo "Target: ${DEPLOY_HOST}"
echo "Directory: ${DEPLOY_DIR}"

# 1. Create backup of current state
echo "--- Creating pre-deploy backup ---"
ssh ${DEPLOY_USER}@${DEPLOY_HOST} "
    mkdir -p ${BACKUP_DIR}
    cd ${DEPLOY_DIR}
    docker-compose exec -T postgres pg_dump -U govihub govihub | gzip > ${BACKUP_DIR}/pre-deploy-\$(date +%Y%m%d%H%M%S).sql.gz
"

# 2. Sync code (exclude data volumes, node_modules, __pycache__)
echo "--- Syncing code ---"
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '__pycache__' \
    --exclude '.env' \
    --exclude 'pgdata' \
    --exclude 'redisdata' \
    --exclude 'uploads' \
    --exclude 'backups' \
    --exclude '.git' \
    ./ ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_DIR}/

# 3. Build and restart services (zero-downtime for API)
echo "--- Building and restarting ---"
ssh ${DEPLOY_USER}@${DEPLOY_HOST} "
    cd ${DEPLOY_DIR}
    
    # Build new images
    docker-compose build --no-cache govihub-api govihub-web
    
    # Run migrations before restart
    docker-compose exec -T govihub-api alembic upgrade head
    
    # Rolling restart (API first, then web)
    docker-compose up -d --no-deps govihub-api
    sleep 10
    docker-compose up -d --no-deps govihub-web
    
    # Reload nginx config
    docker-compose exec -T nginx nginx -s reload
    
    # Verify health
    sleep 5
    curl -f http://localhost:8000/api/v1/health || exit 1
    curl -f http://localhost:3000 || exit 1
    
    echo 'Deployment successful!'
"

echo "=== Deployment complete ==="
```

**scripts/rollback.sh** — Rollback to previous version:
```bash
#!/bin/bash
# Restore from latest backup and restart previous Docker images
```

### 5. Backup Automation

**scripts/backup.sh**:
```bash
#!/bin/bash
# Nightly backup script — add to crontab
# 0 2 * * * /opt/govihub/scripts/backup.sh

BACKUP_DIR="/opt/govihub-backups"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d%H%M%S)

# PostgreSQL dump
docker-compose exec -T postgres pg_dump -U govihub govihub | gzip > ${BACKUP_DIR}/db-${DATE}.sql.gz

# Upload to R2 (if configured)
if [ -n "${R2_BUCKET_NAME}" ]; then
    aws s3 cp ${BACKUP_DIR}/db-${DATE}.sql.gz s3://${R2_BUCKET_NAME}/backups/db-${DATE}.sql.gz --endpoint-url https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
fi

# Cleanup old backups
find ${BACKUP_DIR} -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "Backup completed: db-${DATE}.sql.gz"
```

### 6. Nginx Production Configuration

Update `nginx/conf.d/govihub.conf` for production:

```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_general:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=api_diagnosis:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=api_auth:10m rate=10r/m;

# Gzip compression
gzip on;
gzip_types text/plain application/json application/javascript text/css;
gzip_min_length 1000;

server {
    listen 80;
    server_name govihublk.com www.govihublk.com govihub.lk www.govihub.lk;
    
    # ACME challenge for Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name govihublk.com www.govihublk.com govihub.lk www.govihub.lk;
    
    ssl_certificate /etc/letsencrypt/live/govihublk.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/govihublk.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://accounts.google.com https://openrouter.ai;" always;
    
    # API endpoints
    location /api/ {
        limit_req zone=api_general burst=20 nodelay;
        proxy_pass http://govihub_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        client_max_body_size 10M;
    }
    
    # Auth endpoints (stricter rate limit)
    location /api/v1/auth/ {
        limit_req zone=api_auth burst=5 nodelay;
        proxy_pass http://govihub_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Diagnosis upload (strict rate limit)
    location /api/v1/diagnosis/ {
        limit_req zone=api_diagnosis burst=5 nodelay;
        proxy_pass http://govihub_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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
    
    # Frontend
    location / {
        proxy_pass http://govihub_web;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Static asset caching
    location /_next/static/ {
        proxy_pass http://govihub_web;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 7. Let's Encrypt SSL Setup

**scripts/init-ssl.sh**:
```bash
#!/bin/bash
# Initial SSL certificate setup using Certbot
docker run --rm \
    -v /opt/govihub/certbot/conf:/etc/letsencrypt \
    -v /opt/govihub/certbot/www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d govihublk.com \
    -d www.govihublk.com \
    --email admin@govihublk.com \
    --agree-tos \
    --no-eff-email

# Add to crontab for auto-renewal:
# 0 12 * * * docker run --rm -v /opt/govihub/certbot/conf:/etc/letsencrypt certbot/certbot renew --quiet && docker-compose -f /opt/govihub/docker-compose.yml exec nginx nginx -s reload
```

### 8. Monitoring & Health Checks

**app/admin/health.py** — Enhanced health check:
```python
@router.get("/api/v1/health")
async def health_check(db = Depends(get_db)):
    """
    Returns:
    - status: healthy/degraded/unhealthy
    - version: app version
    - timestamp
    - checks: {database, redis, openrouter, storage}
    """
    checks = {}
    
    # Database check
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except:
        checks["database"] = "failed"
    
    # Redis check
    try:
        redis = await get_redis()
        await redis.ping()
        checks["redis"] = "ok"
    except:
        checks["redis"] = "failed"
    
    # Overall status
    all_ok = all(v == "ok" for v in checks.values())
    
    return {
        "status": "healthy" if all_ok else "degraded",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks
    }
```

### 9. Background Task Scheduler

Create `scripts/scheduler.py` — Simple cron-like scheduler using APScheduler:
```python
"""
Background task scheduler for GoviHub.
Runs weather fetches (hourly), price updates (daily), and cleanup tasks.
Can be run as a separate process: python scripts/scheduler.py
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

# Hourly: Fetch weather for all active users
scheduler.add_job(fetch_all_weather, 'interval', hours=1)

# Daily at 6 AM IST: Fetch market prices
scheduler.add_job(fetch_all_prices, 'cron', hour=6, minute=0, timezone='Asia/Colombo')

# Daily at 2 AM IST: Database backup
scheduler.add_job(run_backup, 'cron', hour=2, minute=0, timezone='Asia/Colombo')

# Daily at 3 AM IST: Expire old listings
scheduler.add_job(expire_old_listings, 'cron', hour=3, minute=0, timezone='Asia/Colombo')

# Weekly: Cleanup old notifications (>90 days)
scheduler.add_job(cleanup_old_notifications, 'cron', day_of_week='sun', hour=4, timezone='Asia/Colombo')
```

Add `apscheduler` to requirements.txt.

### 10. Environment Setup Documentation

Create `docs/SETUP.md`:
```markdown
# GoviHub — Setup Guide

## Prerequisites
- Docker & Docker Compose
- Google Cloud Console project (for OAuth)
- OpenRouter account
- OpenWeather API key
- Cloudflare account (for DNS, CDN, R2)
- Hostinger VPS (4 vCPU, 16GB RAM)

## Development Setup
1. Clone the repository
2. Copy .env.example to .env and fill in values
3. Run `make dev`
4. Access: API at localhost:8000, Frontend at localhost:3000

## Production Deployment
1. SSH into VPS
2. Clone to /opt/govihub
3. Configure .env with production values
4. Run scripts/init-ssl.sh for SSL
5. Run `make prod`
6. Run `make migrate`
7. Run `make seed`
8. Configure crontab for backups and scheduler

## Google OAuth Setup
1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Set authorized redirect URIs:
   - https://govihublk.com/api/auth/callback
   - http://localhost:3000/api/auth/callback (dev)
4. Copy Client ID and Secret to .env

## Domain Configuration
1. In Cloudflare, add A record: govihublk.com → VPS IP
2. Enable Cloudflare proxy (orange cloud)
3. SSL/TLS mode: Full (strict)
4. When govihub.lk is acquired, add CNAME: govihub.lk → govihublk.com
```

### 11. Final Production Checklist File

Create `docs/PRODUCTION_CHECKLIST.md`:
```markdown
# Production Launch Checklist

## Security
- [ ] .env is not in git
- [ ] JWT_SECRET_KEY is randomly generated (32+ bytes)
- [ ] MCP_ADMIN_SECRET is randomly generated
- [ ] DB_PASS is strong and unique
- [ ] CORS origins are restricted to production domains
- [ ] Rate limiting is active on all endpoints
- [ ] CSP headers are configured
- [ ] HTTPS only (HTTP redirects to HTTPS)
- [ ] Cookie secure flag is true

## Infrastructure
- [ ] Docker images build successfully
- [ ] PostgreSQL data volume is on host filesystem
- [ ] Redis data volume is on host filesystem
- [ ] Uploads directory is on host filesystem
- [ ] SSL certificates are valid
- [ ] Cloudflare DNS is configured
- [ ] Cloudflare CDN caching rules set

## Data
- [ ] Database migrations run cleanly
- [ ] Crop taxonomy is seeded (30+ crops)
- [ ] Knowledge base has initial chunks
- [ ] Price history has sample data
- [ ] Admin user is created

## Monitoring
- [ ] Health check endpoint returns 200
- [ ] Backup cron job is scheduled
- [ ] UptimeRobot or similar is configured
- [ ] Log rotation is configured

## Testing
- [ ] All backend tests pass
- [ ] Frontend builds without errors
- [ ] Google OAuth flow works end-to-end
- [ ] Farmer can create listing and get match
- [ ] Buyer can post demand and review matches
- [ ] Diagnosis upload and advice generation works
- [ ] Advisory Q&A returns grounded answers
- [ ] Admin dashboard shows correct stats
- [ ] MCP tools return data
- [ ] Sinhala text renders correctly
- [ ] PWA installs on Android
- [ ] Notifications are received

## Performance
- [ ] API response times < 500ms (p95)
- [ ] CNN inference < 1s
- [ ] OpenRouter calls < 5s
- [ ] Frontend First Contentful Paint < 2s
- [ ] Images are optimized and lazy loaded
```

## Verification

1. All test files exist and have meaningful test cases
2. Docker production build succeeds for all 4 services
3. Health check returns all-green status
4. Deploy script is executable and complete
5. Backup script creates valid SQL dumps
6. Nginx production config has SSL, rate limiting, security headers
7. Scheduler has all required jobs defined
8. Documentation covers full setup process
9. Production checklist is comprehensive

## Output Report
Write report to: `/home/claude/govihub-prompts/reports/REPORT_15_INTEGRATION_DEPLOY.md`
