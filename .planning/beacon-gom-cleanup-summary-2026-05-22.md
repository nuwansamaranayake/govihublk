# beacon-gom Cleanup — Final Summary · 2026-05-22

## Rollback reference
- **Snapshot ID:** `95448878` (VPS 1033016, created 22:00:50 UTC, success)
- **Backup ID (prior):** `38265407` (2026-05-21 14:43 UTC)
- **Full log:** `/root/cleanup-log-2026-05-22.md` on beacon-gom (394 lines, every command + exit code + timestamp)
- **Baseline / phase / final smoke:** `/root/baseline-smoke-2026-05-22.txt`, `/root/phase2-smoke.txt`, `/root/phase3-smoke.txt`, `/root/final-smoke-2026-05-22.txt`

## Survivor smoke — baseline vs final
**PASS.** All 6 survivor brands serve identical status codes to baseline. JSON server-cards for all 4 MCP endpoints valid (Beacon GoM, RegScope, AirShield, FloodPulse).

## What was removed

**Containers (6):** jyotish-engine-api, jyotish-engine-ui, openclaw-nuwan-openclaw-1, openclaw-k1zn-openclaw-1, swarnapali-web, root-n8n-1.

**Images (6 + dangling):** jyotish-engine-backend (376 MB), jyotish-engine-frontend (793 MB), swarnapali-swarnapali-web (462 MB), docker.n8n.io/n8nio/n8n (961 MB), ghcr.io/hostinger/hvps-openclaw latest + dangling (~8 GB combined).

**Source dirs (4):** `/opt/jyotish-engine` (21M), `/opt/swarnapali` (21M), `/docker/openclaw-nuwan` (491M), `/docker/openclaw-k1zn` (59M).

**Systemd units (2):** `openclaw.service`, `moltbot.service` — stopped, disabled, deleted, daemon-reloaded.

**Hidden config (2):** `/root/.openclaw` (7.6M), `/root/.clawdbot` (360K).

**Traefik dynamic configs (7 deleted, 1 edited):**
- Deleted: `astroguru.yml`, `openclaw.yml`, `swarnapali.yml`, `moltbot.yml`, `floodpulse.yml.bak`, `openclaw.yml.backup`, `openclaw.yml.backup_1773951028`
- Edited: `beacongom.yml` — `gomsafety.aigniteconsulting.ai` dropped from rule, `Host(beacongom.com)` kept

**DNS records on aigniteconsulting.ai (6 deleted):** openclaw, gomsafety, n8n, airshield, floodpulse, recallwatch (A records).

**Compose file edited:** `/root/docker-compose.yml` — n8n service removed (traefik service preserved). Backup at `/root/docker-compose.yml.bak-cleanup-2026-05-22`.

## State delta

| Metric | Before | After | Delta |
|---|---|---|---|
| Running containers | 38 | 32 | −6 |
| Images | 31 | 25 | −6 |
| Disk used (/) | 69 GB | **57 GB** | **−12 GB** |
| Compose projects | 14 | 9 | −5 |
| Traefik routers | 28 | 17 | −11 |

## Pre-existing issues NOT caused by cleanup (formalized baseline)

Allowed status codes for all smoke tests: **200, 301, 302, 307, 308**.

| Surface | Status | Invariant |
|---|---|---|
| `beacongom.com` + `www.beacongom.com` | 000 (TLS apex missing) | Must stay 000, not regress to 5xx |
| ~~`recallwatchai.com/mcp`~~ | **FULLY FIXED 2026-05-22 23:05 UTC** — SSE handshake + `/messages` POST roundtrip verified end-to-end. JSON-RPC `initialize` returns `RecallWatch v3.1.1` capabilities. | Two-router pattern: `recallwatch-mcp` (`/mcp`→`/sse` rewrite) + `recallwatch-mcp-messages` (`/messages`→backend, no rewrite). Both → `127.0.0.1:8006`. |
| `publicmcp.recallwatchai.com` | — | DROPPED from survivor list (never existed on this VPS) |
| `regscope-public-mcp` healthcheck | flaps unhealthy (httpx GET → 429 rate limit) | Real endpoint serves 200; design bug |

Final smoke (post-cleanup) **PASS = 0 FAILs** under this policy.

## 🚨 MANUAL FOLLOW-UP (you must do these)

### Critical / immediate

1. **[x] Credential hygiene** *(done 2026-05-23)* — OpenAI, BraveSearch, Moltbook keys purged from VPS filesystem (logs redacted, .env lines removed, obsolete `.bak` files deleted, `recallwatch-backend` container restarted to clear stale env). OpenRouter preserved (no production .env on this VPS uses it currently). Backups in `/root/.credential-cleanup-backups/` (chmod 600). Future Claude Code sessions on this box will not trip the safety classifier. **Provider-side revocation is a separate manual step** (see followup #1).
   - [ ] Manual revoke at provider dashboards: OpenAI (`[REDACTED-OPENAI]`), BraveSearch (`[REDACTED-BRAVE]`), Moltbook (`[REDACTED-MOLTBOOK]`). Low priority since keys are not in active use on this VPS, but they remain live credentials at the providers.

2. **[x] Delete `astroguru.cc` DNS records** — DONE 2026-05-22 (user confirmed via separate registrar).
3. **[x] n8n full purge** — DONE 2026-05-22 residue session (container/volume/image absent; node module + backups removed). *Two cosmetic leftovers awaiting auth — see Open Items below.*
4. **[x] openclaw/clawdbot binary purge** — DONE 2026-05-22 residue session (`/usr/bin/openclaw` symlink, `/usr/lib/node_modules/openclaw` 1.4 GB, `/var/log/openclaw-*.log` x3, `/root/openclaw-backups`, root crontab orphan entries — all removed). Watchdog resurrector loop killed; log did NOT reappear in 2-min verification window.

### Important / soon

3. **[x] Fix `beacongom.com` apex** *(done 2026-05-23 ~06:55 UTC)* — was NOT a TLS issue (cert was always valid via SAN). Root cause: stale docker bridge rules on `beacon-gom_default` network blocking TCP between `beacon-gom-nginx-1` and `beacon-gom-frontend-1` despite same-network attachment. **Fix that worked:** `docker compose down` + `docker network prune -f` + `docker compose up -d` for the `/opt/beacon-gom` stack (rebuilt network from 172.23.0/16 → 172.18.0/16, fresh iptables rules). `restart`, `--force-recreate`, and `network disconnect/connect` all preserved the stale bridge and failed. Also added `proxy_http_version 1.1` + `Connection ""` + X-Forwarded-* headers + timeouts to `location /` in `/opt/beacon-gom/nginx.conf` as a precaution. Backup: `/opt/beacon-gom/nginx.conf.bak-fix-2026-05-23`. Audit: `/root/beacongom-fix-loop.md`.

## Contentful edits completed 2026-05-22 (user-authorized)

| File | Edit | Backup |
|---|---|---|
| `/root/docker-compose.yml` | `n8n_data:` external volume block removed (compose config validates). | `/root/docker-compose.yml.bak-residue-2026-05-22` |
| `/root/.env` | Removed `DOMAIN_NAME`, `SUBDOMAIN=n8n`, 2 n8n comment lines. `GENERIC_TIMEZONE` + `SSL_EMAIL` preserved. | `/root/.env.bak-residue-2026-05-22` |

All survivors green (0 FAILs). Traefik not reloaded (files outside dynamic dir).
4. ~~Fix `recallwatchai.com/mcp` routing~~ — **FULLY DONE 2026-05-22 23:05 UTC**. SSE handshake + `/messages` POST both routed. Verified with real MCP `initialize` JSON-RPC roundtrip → server responded with full capabilities.
5. **Lock regpulse DB/Redis/MinIO ports** from `0.0.0.0` to `127.0.0.1` (currently exposed: 9502, 9503, 9504, 9505). Edit `/opt/regpulse/docker-compose.prod.yml` and recreate.
6. **Confirm no production automation depended on n8n** — Stripe webhooks, Resend triggers, Smithery sync, etc. The `n8n_data` volume was destroyed.

### Nice to have

6. Stale `/usr/bin/openclaw` and `/usr/bin/clawdbot` binaries may still exist; remove if you want a full purge (they're now orphaned since the systemd units that called them are gone).
7. `regscope-public-mcp` healthcheck design — change healthcheck to HEAD or to a `/healthz` endpoint that isn't rate-limited.
