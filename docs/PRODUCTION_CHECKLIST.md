# GoviHub Production Launch Checklist

**Version:** 1.0.0
**Last Updated:** 2026-03-23

This checklist must be completed before going live. Each section should be signed off by a responsible team member.

---

## Security

### Authentication & Secrets

- [ ] `JWT_SECRET_KEY` is at least 256-bit random value (`openssl rand -hex 32`)
- [ ] `MCP_ADMIN_SECRET` is a strong random secret
- [ ] `DB_PASS` is a unique, strong password (not `password`)
- [ ] `.env` file is NOT committed to version control
- [ ] `.env` permissions are `600` on the server (`chmod 600 /opt/govihub/.env`)
- [ ] `APP_DEBUG=false` in production
- [ ] Google OAuth redirect URIs are restricted to production domains only
- [ ] Firebase service account key (`fcm-credentials.json`) has minimal permissions

### Network Security

- [ ] VPS firewall only exposes ports 22, 80, 443
- [ ] SSH root login is disabled (`PermitRootLogin no` in `sshd_config`)
- [ ] SSH password authentication is disabled (`PasswordAuthentication no`)
- [ ] Fail2ban is installed and configured for SSH
- [ ] Docker daemon is not exposed on network (no `-H tcp://`)
- [ ] Internal services (Postgres, Redis) are not exposed outside Docker network

### TLS/HTTPS

- [ ] SSL certificates are valid and not expiring within 30 days
- [ ] HTTPS redirect is working (HTTP → HTTPS)
- [ ] HSTS header is set (`Strict-Transport-Security: max-age=63072000`)
- [ ] TLS 1.0 and 1.1 are disabled
- [ ] SSL Labs test score is A or higher (https://ssllabs.com/ssltest/)
- [ ] Certificate auto-renewal cron is configured

### Application Security

- [ ] CORS origins are restricted to production domains
- [ ] Rate limiting is active on auth, diagnosis, and advisory endpoints
- [ ] `X-Frame-Options: SAMEORIGIN` header is set
- [ ] Content Security Policy header is configured
- [ ] `X-Content-Type-Options: nosniff` is set
- [ ] Admin endpoints return 403 for non-admin users
- [ ] API docs (`/api/v1/docs`) access is reviewed (restrict if needed)

---

## Infrastructure

### Server Configuration

- [ ] Server has 4GB+ RAM, 2+ vCPU
- [ ] Disk usage is below 70%
- [ ] NTP is synchronised (`timedatectl status`)
- [ ] Swap space is configured (at least 2GB)
- [ ] Kernel is up to date (`apt upgrade`)
- [ ] Unattended upgrades are enabled for security patches

### Docker

- [ ] Docker version is 24.0+
- [ ] Docker Compose v2 is installed
- [ ] All containers are healthy (`docker compose ps`)
- [ ] Container restart policies are set (`unless-stopped`)
- [ ] Resource limits (memory, CPU) are configured per container

### Database

- [ ] PostgreSQL is running and accessible
- [ ] PostGIS extension is installed and enabled
- [ ] pgvector extension is installed and enabled
- [ ] All Alembic migrations have been applied (`alembic current`)
- [ ] Database connection pooling is configured
- [ ] `pg_isready` health check passes

### Redis

- [ ] Redis is running (`redis-cli ping` returns PONG)
- [ ] Redis `maxmemory` policy is set (`allkeys-lru` recommended)
- [ ] Redis password is set if accessible from untrusted networks

---

## Data

### Crop Taxonomy

- [ ] All 50+ Sri Lankan crops are seeded
- [ ] Sinhala (`name_si`) and Tamil (`name_ta`) names are populated
- [ ] Crop categories are correctly assigned
- [ ] Seasonal data is populated for major crops

### Knowledge Base

- [ ] Agricultural knowledge chunks are seeded in English
- [ ] Sinhala knowledge chunks are seeded (for bilingual advisory)
- [ ] Embeddings are generated for all chunks (check vector dimension)
- [ ] At least 50 knowledge documents are available

### Market Prices

- [ ] Initial price data is seeded
- [ ] Price sources are documented
- [ ] Price update scheduler is running

### Admin Account

- [ ] Admin user has been created
- [ ] Admin credentials are stored securely (not in any config file)
- [ ] Admin can log in via the admin panel

---

## Monitoring & Observability

### Logging

- [ ] Structured JSON logs are enabled in production
- [ ] Log rotation is configured (prevent disk fill)
- [ ] Error logs are being collected
- [ ] Sensitive data (passwords, tokens) is NOT logged

### Alerting

- [ ] Server uptime monitoring is set up (UptimeRobot, BetterStack, etc.)
- [ ] `/api/v1/health` endpoint is monitored (alert on failure)
- [ ] Disk space alert at 80% usage
- [ ] Memory usage alert at 85% usage
- [ ] Database connection pool exhaustion alerts

### Backups

- [ ] Automated daily backup is scheduled (`scripts/scheduler.py`)
- [ ] Backup successfully uploads to Cloudflare R2
- [ ] Backup retention policy is set (30 days local, 90 days R2)
- [ ] Restore from backup has been tested
- [ ] Backup size is reasonable (not unexpectedly zero or tiny)

---

## Testing

### Functional Testing

- [ ] All API endpoints respond correctly
- [ ] User registration flow works end-to-end (all 3 roles)
- [ ] Google OAuth login succeeds
- [ ] JWT token creation and refresh work
- [ ] Harvest listing CRUD works for farmers
- [ ] Demand posting CRUD works for buyers
- [ ] Supply listing CRUD works for suppliers
- [ ] Matching algorithm produces results
- [ ] Diagnosis endpoint accepts images and returns predictions
- [ ] Advisory endpoint returns contextual answers
- [ ] Admin dashboard shows correct statistics
- [ ] MCP SSE connection establishes correctly

### Integration Testing

- [ ] `bash scripts/build-test.sh` passes with 0 test failures
- [ ] Tests cover all critical paths (auth, listings, matching)
- [ ] Mocked external services work correctly in tests

### Load Testing

- [ ] API can handle 100 concurrent users without errors
- [ ] Database query times are below 500ms (p95)
- [ ] Matching algorithm completes within 2 seconds
- [ ] Image diagnosis API responds within 10 seconds
- [ ] Advisory LLM calls return within 30 seconds

---

## Performance

### API Performance

- [ ] Database queries use indexes (check `EXPLAIN ANALYZE` on slow queries)
- [ ] N+1 query patterns have been resolved
- [ ] Redis caching is working for weather and price data
- [ ] Connection pool size is appropriate (20 max connections)
- [ ] Async operations are properly awaited

### Frontend Performance

- [ ] Next.js build is production-optimised (`NODE_ENV=production`)
- [ ] Static assets have cache headers (`Cache-Control: immutable`)
- [ ] Images are optimised (WebP format where possible)
- [ ] JavaScript bundle size is reasonable (check with `next build` output)
- [ ] First Contentful Paint (FCP) is below 2 seconds on mobile

### Nginx

- [ ] Gzip compression is enabled
- [ ] Static assets are served with proper caching headers
- [ ] Connection keepalive is configured
- [ ] Worker processes match CPU count

---

## External Services

### OpenRouter (LLM)

- [ ] API key is valid and has sufficient credits
- [ ] Model (`anthropic/claude-sonnet-4`) is available
- [ ] Fallback behaviour works when LLM is unavailable
- [ ] Rate limits are understood and handled

### OpenWeather

- [ ] API key is valid
- [ ] Sri Lanka weather data is returning correctly
- [ ] Weather alert logic handles API failures gracefully

### Cloudflare R2

- [ ] Bucket exists with correct name
- [ ] Access key has read/write permissions on the bucket
- [ ] Public URL resolves to uploaded files
- [ ] CORS is configured on the R2 bucket

### Firebase (FCM)

- [ ] Firebase project is created
- [ ] Service account credentials file is deployed
- [ ] FCM can send test notifications
- [ ] Android/iOS apps are registered in Firebase

### Twilio (SMS)

- [ ] Account SID and auth token are valid
- [ ] Sender phone number is verified
- [ ] Test SMS sends successfully to a Sri Lankan number (+94)

---

## Documentation & Handoff

### Documentation

- [ ] `docs/SETUP.md` is up to date
- [ ] API documentation is accessible at `/api/v1/docs`
- [ ] All environment variables are documented in `.env.example`
- [ ] Deployment runbook is accessible to the ops team
- [ ] On-call runbook is written for common failure scenarios

### Access

- [ ] Production `.env` file is stored securely (password manager)
- [ ] SSH access is provisioned for all required team members
- [ ] Admin credentials are shared securely with relevant team members
- [ ] Domain registrar access is shared with ops team
- [ ] Cloudflare/hosting panel access is shared

---

## Sign-off

| Section | Verified By | Date | Notes |
|---------|------------|------|-------|
| Security | | | |
| Infrastructure | | | |
| Data | | | |
| Monitoring | | | |
| Testing | | | |
| Performance | | | |
| External Services | | | |
| Documentation | | | |

**Final Go/No-Go Decision:**

- [ ] **GO** — All critical items checked, ready for production launch
- [ ] **NO-GO** — Outstanding issues (list below)

Outstanding Issues:
```
(none)
```

Signed off by: _____________________ Date: ___________
