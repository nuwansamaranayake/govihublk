# `beacon-gom` (82.197.95.191) — Post-Restore Inventory · 2026-05-22 21:30 UTC

Restored from backup ID 38265407 (2026-05-21 14:43 UTC). All projects running 3 hours.

## Brand domain smoke test (post-restore)

| Domain | HTTP | Notes |
|---|---|---|
| https://regscopeai.com | **307 → /login** ✅ | Normal redirect (just like other AI apps). `/docs` `/openapi.json` `/login` all 200. **Restored fully.** |
| https://www.regscopeai.com | 307 | OK |
| https://floodpulseai.com | 200 ✅ | |
| https://recallwatchai.com | 200 ✅ | |
| https://airshieldai.com | 200 ✅ | |
| https://publicmcp.regscopeai.com | 200 ✅ | |
| https://publicmcp.floodpulseai.com | 200 ✅ | |
| https://publicmcp.airshieldai.com | 200 ✅ | |

## 14 Docker compose projects, 38 running containers

| # | Project | Path | Containers | Public brand / route |
|---|---|---|---|---|
| 1 | airshield | `/opt/airshield` | 3 (backend **unhealthy**) | airshieldai.com + airshield.aigniteconsulting.ai |
| 2 | airshield-public-mcp | `/opt/airshield-public-mcp` | 2 healthy | publicmcp.airshieldai.com (:9520) |
| 3 | beacon-gom | `/opt/beacon-gom` | 4 healthy | gomsafety.aigniteconsulting.ai + publicmcp.beacongom.com (:8090) |
| 4 | drapestudio | `/opt/DrapeStudio` | 3 (worker+api+redis) | drapestudiolk.com (:8000 via traefik) |
| 5 | floodpulse | `/opt/floodpulse` | 5 healthy | floodpulseai.com + floodpulse.aigniteconsulting.ai |
| 6 | floodpulse-public-mcp | `/opt/floodpulse-public-mcp` | 2 healthy | publicmcp.floodpulseai.com (:9510) |
| 7 | jyotish-engine | `/opt/jyotish-engine` | 2 healthy | **astroguru** subdomain (:4200/:4201) ⚠ name mismatch |
| 8 | openclaw-k1zn | `/docker/openclaw-k1zn` | 1 | port 57292 only — no traefik route, looks like a test |
| 9 | openclaw-nuwan | `/docker/openclaw-nuwan` | 1 | openclaw.aigniteconsulting.ai (:18790) |
| 10 | recallwatch | `/opt/recallwatch` | 4 healthy | recallwatchai.com + recallwatch.aigniteconsulting.ai |
| 11 | **regpulse** | `/opt/regpulse` | 6 (backend `unhealthy` after restore — check) | **regscopeai.com** + regscope-public-mcp adjacent |
| 12 | regscope-public-mcp | `/opt/regscope-public-mcp` | 2 healthy | publicmcp.regscopeai.com (:9511) |
| 13 | root | `/root` | 2 (traefik + n8n) | infra + n8n.aigniteconsulting.ai |
| 14 | swarnapali | `/opt/swarnapali` | 1 **unhealthy** | swarnapali.demostudio.cc |

## Project name ↔ public brand map (CRITICAL)

| Internal name | Public brand domain |
|---|---|
| `regpulse` | **`regscopeai.com`** |
| `jyotish-engine` | **`astroguru.*`** (subdomain) |
| `beacon-gom` | `gomsafety.aigniteconsulting.ai` / `publicmcp.beacongom.com` |
| `drapestudio` | `drapestudiolk.com` |
| `swarnapali` | `swarnapali.demostudio.cc` |
| `floodpulse` | `floodpulseai.com` (matches) |
| `recallwatch` | `recallwatchai.com` (matches) |
| `airshield` | `airshieldai.com` (matches) |

## Traefik routers (24 enabled)

Live config in `/etc/traefik/dynamic/` (17 yml files including stale backups). All traefik routes verified enabled. Highlights:
- regscope-frontend → `:9500`, regscope-api → `:9501`, regscope-mcp → `:9506`, publicmcp-regscopeai-nginx → `:9511` (all alive)
- `moltbot@file` → port `:18789` — **no container listening on 18789** (orphan route, moltbot container not running)

## Resource footprint

```
Images          31   38.64 GB  (1.95 GB reclaimable)
Containers      38   126 MB    (0 reclaimable)
Local Volumes   36    5.07 GB  (545 MB reclaimable, **22 ORPHANED**)
Build Cache    298   14.52 GB  (ALL reclaimable)
```

**14.5 GB of build cache + ~545 MB orphan volumes = ~15 GB free with `docker builder prune -af && docker volume prune -f`.**

## Listening TCP ports

`22 53 80 443 3100 3200 4200 4201 5050 5433 5435 5678 6379 8000 8002 8006 8080 8090 8100 8200 9500 9501 9502 9503 9504 9505 9506 9510 9511 9520 9600 9601 9602 18790 57292`

Notably: `5678` (n8n), `8080` (traefik dashboard), `9502+9503+9504+9505` (regpulse db/redis/minio exposed on 0.0.0.0 — **public DB ports, security concern**), `5433+5435` (extra DB ports).

## Traefik dynamic file cleanup candidates

- `floodpulse.yml.bak`
- `openclaw.yml.backup`
- `openclaw.yml.backup_1773951028`

Safe to delete (Traefik ignores `.bak` / `.backup*`).

## Issues / cleanup matrix

| # | Item | Severity | Action |
|---|---|---|---|
| 1 | **regpulse-backend-1 currently `unhealthy`** post-restore | medium | Investigate healthcheck after 3hr uptime |
| 2 | swarnapali-web `unhealthy` (was so before too) | low | Decide retire vs fix |
| 3 | airshield-backend-1 `unhealthy` (was so before too) | medium | Same |
| 4 | `moltbot@file` traefik route → port 18789 with NO listener | low | Either start moltbot or remove route |
| 5 | regpulse db/redis/minio **bound to 0.0.0.0** (ports 9502-9505) | **HIGH** | Should be 127.0.0.1 only — security risk |
| 6 | 22 orphan volumes (545 MB reclaim) | low | `docker volume prune -f` |
| 7 | 14.5 GB build cache | low | `docker builder prune -af` |
| 8 | 3 stale `.bak/.backup*` files in `/etc/traefik/dynamic/` | low | `rm` |
| 9 | `openclaw-k1zn` container on port 57292 — purpose? | low | Identify or remove |
