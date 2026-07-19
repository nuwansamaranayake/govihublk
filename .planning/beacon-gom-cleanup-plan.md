# beacon-gom (82.197.95.191) — Deep Cleanup Plan · 2026-05-22

**User-stated KEEP list (only these public domains):**
1. https://beacongom.com (+ www + publicmcp.beacongom.com)
2. https://regscopeai.com (+ www + publicmcp.regscopeai.com)
3. https://airshieldai.com (+ www + publicmcp.airshieldai.com)
4. https://floodpulseai.com (+ www + publicmcp.floodpulseai.com)
5. https://recallwatchai.com (+ www)
6. https://drapestudiolk.com (+ www)

**Explicit REMOVE list:** openclaw, astroguru.cc, gomsafety.aigniteconsulting.ai.

---

## Layer 1 — Compose projects to remove (4 projects, 4 containers)

| Project | /opt path | Containers | Disk source | Images (locally-built) | Volumes |
|---|---|---|---|---|---|
| **jyotish-engine** (→ `astroguru.cc`) | `/opt/jyotish-engine` | jyotish-engine-api, jyotish-engine-ui | 21 MB | jyotish-engine-backend (376 MB), jyotish-engine-frontend (793 MB) | none discovered |
| **openclaw-nuwan** (→ `openclaw.aigniteconsulting.ai`) | `/docker/openclaw-nuwan` | openclaw-nuwan-openclaw-1 | 491 MB | uses shared `ghcr.io/hostinger/hvps-openclaw` (3.99 GB — also used by k1zn) | volume(s) under `data/` are bind mounts on disk |
| **openclaw-k1zn** (no traefik route, port 57292) | `/docker/openclaw-k1zn` | openclaw-k1zn-openclaw-1 | 59 MB | shares same hvps-openclaw image | bind-mounted `data/` |
| **swarnapali** (→ `swarnapali.demostudio.cc`) | `/opt/swarnapali` | swarnapali-web (unhealthy) | 21 MB | swarnapali-swarnapali-web (462 MB) | none discovered |

**Container teardown commands:**
```bash
ssh beacon-gom 'cd /opt/jyotish-engine && docker compose -f docker-compose.prod.yml down -v --remove-orphans'
ssh beacon-gom 'cd /docker/openclaw-nuwan && docker compose down -v --remove-orphans'
ssh beacon-gom 'cd /docker/openclaw-k1zn && docker compose down -v --remove-orphans'
ssh beacon-gom 'cd /opt/swarnapali && docker compose down -v --remove-orphans'
```

**Image removal (after compose down):**
```bash
ssh beacon-gom 'docker image rm jyotish-engine-backend jyotish-engine-frontend swarnapali-swarnapali-web ghcr.io/hostinger/hvps-openclaw:latest 2>&1'
# Also dangling: ghcr.io/hostinger/hvps-openclaw <none> (4.05 GB)
ssh beacon-gom 'docker image prune -f'
```

**Source dir removal:**
```bash
ssh beacon-gom 'rm -rf /opt/jyotish-engine /opt/swarnapali /docker/openclaw-nuwan /docker/openclaw-k1zn'
```

**Estimated disk reclaim:** ~7 GB (mostly the dual `hvps-openclaw` images = ~8 GB combined, but only ~6 GB shared layer reclaim after dangling cleanup; plus 2.3 GB from other images + 592 MB sources)

---

## Layer 2 — Traefik dynamic configs to DELETE (3 files)

```bash
ssh beacon-gom 'rm /etc/traefik/dynamic/astroguru.yml /etc/traefik/dynamic/openclaw.yml /etc/traefik/dynamic/swarnapali.yml /etc/traefik/dynamic/moltbot.yml'
```

Also the 3 stale `.bak/.backup*` files cluttering Traefik's config dir:
```bash
ssh beacon-gom 'rm /etc/traefik/dynamic/floodpulse.yml.bak /etc/traefik/dynamic/openclaw.yml.backup /etc/traefik/dynamic/openclaw.yml.backup_1773951028'
```

## Layer 3 — Traefik dynamic configs to EDIT (1 file)

**`beacongom.yml`** — currently has rule `Host(gomsafety.aigniteconsulting.ai) || Host(beacongom.com)`. Edit to keep only beacongom.com:
```yaml
# BEFORE:
rule: "Host(`gomsafety.aigniteconsulting.ai`) || Host(`beacongom.com`)"
# AFTER:
rule: "Host(`beacongom.com`)"
```
The other rule `Host(www.beacongom.com)` stays as-is. `publicmcp-beacongom.yml` stays unchanged.

---

## Layer 4 — Auxiliary cleanup (cron, systemd, hidden config)

**Cron jobs to remove (OpenClaw-related):**
- Watchdog: every 2 minutes (likely in `/etc/cron.d/openclaw-watchdog` or `/etc/cron.d/openclaw-*`)
- Security audit: every 6 hours
- Log rotation: weekly
```bash
ssh beacon-gom 'ls /etc/cron.d/ | grep -i openclaw; rm /etc/cron.d/openclaw-* 2>&1'
```

**Systemd unit:**
```bash
ssh beacon-gom 'systemctl stop moltbot 2>&1; systemctl disable moltbot 2>&1; rm /etc/systemd/system/moltbot.service; systemctl daemon-reload'
```

**Hidden config dirs:**
```bash
ssh beacon-gom 'rm -rf /root/.openclaw /root/.clawdbot'
```

---

## Layer 5 — DNS records to DELETE

### On `aigniteconsulting.ai` (Hostinger DNS — I can do this via API):
| Record | Type | Currently → | Action |
|---|---|---|---|
| `openclaw.aigniteconsulting.ai` | A | 82.197.95.191 | **DELETE** |
| `gomsafety.aigniteconsulting.ai` | A | 82.197.95.191 | **DELETE** |
| `n8n.aigniteconsulting.ai` | A | 82.197.95.191 | **DELETE if also removing n8n** (see Layer 6) |

### On `astroguru.cc` (NOT Hostinger DNS — needs your registrar action):
| Record | Type | Action |
|---|---|---|
| `@` (apex) → 82.197.95.191 | A | DELETE at registrar |
| `www` | CNAME/A | DELETE at registrar |
| Whatever other subdomains exist | — | DELETE |

I can't touch astroguru.cc DNS — it's not on Hostinger. Tell me which registrar and I'll guide; or do it manually.

---

## Layer 6 — DECISIONS NEEDED before I touch anything

| # | Question | Default if you don't answer |
|---|---|---|
| 1 | **n8n** (`n8n.aigniteconsulting.ai`, container `root-n8n-1`, image 961 MB, has data volume `n8n_data`) — keep or remove? Not in your 6-domain list. | Assume REMOVE since not in keep list |
| 2 | **`*.aigniteconsulting.ai` subdomains for the kept brands**: airshield/floodpulse/recallwatch each still have `<brand>.aigniteconsulting.ai` DNS + traefik route that point to the same backend as the `.com` brand. Keep these aliases for backward compat, or also retire? | Keep (low cost, backward-compat) |
| 3 | **n8n_data volume** if removing n8n — destroy it (your workflows go away) or back it up first? | Destroy (matches your prior cleanup intent) |
| 4 | **regpulse db/redis/minio bound to 0.0.0.0** (ports 9502-9505) — security exposure. Lock to 127.0.0.1? | Recommend yes — separate small fix |
| 5 | **moltbot systemd unit** — what was it for? Looks abandoned. Removing it along with openclaw seems right. Confirm? | Remove with openclaw |
| 6 | **Bind-mounted `data/` directories** under `/docker/openclaw-nuwan/data/` and `/docker/openclaw-k1zn/data/` — destroy with the source dirs? They hold openclaw runtime state. | Destroy (matches "remove openclaw" intent) |

---

## Layer 7 — What survives after all of the above (target state)

**Compose projects remaining (10 of 14):**
1. airshield (airshieldai.com)
2. airshield-public-mcp (publicmcp.airshieldai.com)
3. beacon-gom (beacongom.com + publicmcp.beacongom.com)
4. drapestudio (drapestudiolk.com)
5. floodpulse (floodpulseai.com)
6. floodpulse-public-mcp (publicmcp.floodpulseai.com)
7. recallwatch (recallwatchai.com)
8. regpulse (regscopeai.com)
9. regscope-public-mcp (publicmcp.regscopeai.com)
10. root (traefik — n8n removed if Q1 is "remove")

**Traefik routers remaining (~17 of 28):**
- airshield-* (3 routes) · drapestudiolk · floodpulse-* (3 wildcards) · floodpulseai-* (5 routes) · publicmcp-airshieldai/beacongom/floodpulseai/regscopeai · recallwatch-* (3 routes) · regscope-* (3 routes) · beacongom (edited) · beacongom-www · publicmcp-beacongom

**Traefik routers gone (~11):**
- astroguru-frontend, astroguru-api
- openclaw
- moltbot
- swarnapali-http, swarnapali
- beacongom (gomsafety part edited out)
- n8n@docker (if removing n8n)
- floodpulse/recallwatch/airshield `*.aigniteconsulting.ai` aliases (optional per Q2)

**Listening ports gone:** 4200, 4201 (astroguru), 5050 (swarnapali), 18789 (moltbot), 18790 (openclaw-nuwan), 57292 (openclaw-k1zn), 5678 (n8n — if removed).

**Estimated total reclaim:** ~10 GB disk (images + sources + n8n if removed) + several hundred MB RAM from 4-5 fewer containers.

---

## Execution order (when authorized)

1. **DNS first** (lowest-blast-radius reverse: stop traffic flowing in) — delete `openclaw`, `gomsafety`, `n8n?` A records on aigniteconsulting.ai
2. **Traefik edits** — drop the to-remove dynamic files + edit beacongom.yml (Traefik watches the dir, reloads in ~5s)
3. **Smoke test** — confirm the 6 KEEP brand domains still 200/302/307
4. **Compose down** — tear down jyotish-engine, openclaw-nuwan, openclaw-k1zn, swarnapali (and n8n if removing)
5. **Image + volume prune**
6. **Source dir removal** — `/opt/jyotish-engine /opt/swarnapali /docker/openclaw-*`
7. **Cron + systemd cleanup** — openclaw cron jobs, moltbot service
8. **Hidden config cleanup** — `/root/.openclaw /root/.clawdbot`
9. **Astroguru.cc DNS** — manual step at registrar
10. **Final smoke test** — all 6 KEEP domains still serving
