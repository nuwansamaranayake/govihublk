# `aignite-web` (82.197.94.206) — Full Docker Inventory · 2026-05-22

Box: CloudPanel template (Ubuntu 22.04), KVM 4 (4 vCPU / 15 GB RAM / 194 GB disk), **73% disk used, 13 weeks uptime**.

CloudPanel itself only manages **one site**: `/home/clp/htdocs/app`. Everything else runs as Docker compose projects outside CloudPanel.

---

## 11 Docker compose projects (23 running containers)

| # | Project | Path | Containers | Notes |
|---|---|---|---|---|
| 1 | **aigniteconsulting** | `/opt/aigniteconsulting` | 1 running | Serves `aigniteconsulting.ai` (Next.js, port 3000). Live, 2-day uptime. |
| 2 | **analogguard** | `/opt/analogguard` | 2 running | `analogguard.com` (Express app + postgres). 4 months old image. |
| 3 | **cosmic-nexus-v2** | `/opt/cosmic-nexus-v2` | 4 running + **3 exited** | user-frontend, calc-engine, admin-v2, knowledge-mgmt, postgres, redis, mongo. Likely superseded by `v2` below + cosmicnexus on `cosmic-nexus` VPS (226.15). |
| 4 | **v2** | `/opt/cosmic-nexus-v2/deploy/v2` | 3 running | cosmic-frontend-v2, profiles-v2, api-v2. Subdirectory of project 3 — looks like a partial re-deployment. |
| 5 | **cosmicnexus** | `/opt/cosmicnexus` | 1 running | A THIRD "cosmic" stack. Single container (`cosmicnexus-app`). |
| 6 | **docker** (aka primepath-hr) | `/opt/primepath-hr/docker` | 6 running | primepath-web, -api, -db, -mq (rabbitmq 3.13), -storage (minio), -cache. Healthy. `primepathhr.ai` 404s — routing not wired. |
| 7 | **vedic-astro-engine** | `/opt/vedic-astro-engine` | 2 running + **2 exited** | vedic-backend, vedic-postgres, vedic-redis, vedic-admin. 5-month-old code. |
| 8 | **shanu_pro_fixed** | `/opt/shanulanka/shanu_pro_fixed` | 1 running | `shanulankatours.com` (Next.js, container `shanulanka_nextjs`). 3-week uptime. |
| 9 | **whisper-local** | `/opt/whisper-local` | 1 running | OpenAI Whisper STT (likely behind `transcribe.aigniteconsulting.ai`). 5 months old. |
| 10 | **traefik** | `/opt/traefik` | 1 running | Reverse proxy (`traefik.aigniteconsulting.ai`, auth-gated). Routes most subdomains. |
| 11 | **suna-deployment** | `/root/suna-deployment` | 1 running | Only rabbitmq is up — rest of `suna-deployment` stack appears removed. Orphan. |
| 12 | (root) | `/root/docker-compose.yml` | — | Older root-level compose. Status unclear. |

**Total: 23 running + 5 exited containers** across **11 compose projects**.

## Orphan volumes (no compose project on disk)

| Volume | Size | Origin |
|---|---|---|
| `shanulankatours-deployment_shanulankatours_redis_data` | 264 B | Old shanulankatours deployment (now replaced by `shanu_pro_fixed`) |
| `shanulankatours-deployment_shanulankatours_uploads` | 175 B | " |
| `shanulankatours-deployment_wordpress` | 0 B | " (was a WordPress version of the site?) |
| `n8n-deployment_n8n_data` | **34.9 MB** | n8n was removed (n8n now runs on `beacon-gom` 95.191) |
| `n8n-deployment_traefik_data` | 163 KB | " |

**5 orphan volumes** = ~35 MB reclaim + cleanup hygiene.

## Backup / leftover directories on disk

- `/opt/whisper-local-backup-20251223-095233` — backup from **Dec 23, 2025** (5 months old).

## CloudPanel surface

- `/home/clp/htdocs/`: only `app` (one site, unknown content yet).
- `/home/`: `app, clp, mysql, ubuntu` (standard CloudPanel layout, `ubuntu` user inactive).

## Nginx vhost surface (outside CloudPanel)

Only `aigniteconsulting.ai www.aigniteconsulting.ai` has an explicit nginx server block in `/etc/nginx/sites-enabled/`. All other domains (analogguard, shanulankatours, primepathhr, paylk, transcribe) must be routed by **Traefik** (project 10) — explains why they sometimes 404 when Traefik labels are misconfigured.

## Listening TCP ports

`21 22 25 53 80 443 3002 3306 5672 6081 8000 8001 8002 8080 8765 11000 11211 12000 13000 14000 15000 15672 16000 17000 18000 19000 20000 27017 33060 38907 46101`

Suspicious: the ladder `11000, 12000, 13000, ..., 20000` is 10 ports at round intervals. That's likely Traefik or one stack exposing many services. Worth checking what's bound to them.

Also live: `25` (SMTP, postfix?), `3306+33060` (MySQL), `27017` (MongoDB host-level), `5672+15672` (RabbitMQ AMQP+mgmt), `6081` (Varnish?), `11211` (Memcached), `8765` (Bitwarden?).

---

## DNS records pointing at this box (after today's cleanup)

| Subdomain | Currently serves? | Likely owner |
|---|---|---|
| `aigniteconsulting.ai` (+ www) | ✅ 200 | project 1 (aigniteconsulting) |
| `shanulankatours.com` (+ www) | ✅ 200 | project 8 (shanu_pro_fixed) |
| `analogguard.com` | ✅ 200 | project 2 (analogguard) |
| `primepathhr.ai` | ❌ 404 | project 6 exists but route not wired |
| `paylk.aigniteconsulting.ai` | ✅ 200 (nginx) | unclear which container |
| `transcribe.aigniteconsulting.ai` | ✅ 200 (TornadoServer) | project 9 (whisper-local) |
| `traefik.aigniteconsulting.ai` | ✅ 401 | project 10 (traefik dashboard) |
| `gomsafety / openclaw / n8n / recallwatch / floodpulse / airshield` | ✅ — | NOT on this box, on `beacon-gom` |

---

## Cleanup candidates (need your call per item)

### High confidence — clearly stale
| # | Item | Action | Reclaim |
|---|---|---|---|
| A1 | 3× `shanulankatours-deployment_*` orphan volumes | `docker volume rm` | ~440 B + hygiene |
| A2 | 2× `n8n-deployment_*` orphan volumes | `docker volume rm` | ~35 MB + hygiene |
| A3 | `/opt/whisper-local-backup-20251223-095233` | `rm -rf` | size unknown (likely 100s of MB) |
| A4 | 3× exited containers in `cosmic-nexus-v2` | prune | small |
| A5 | 2× exited containers in `vedic-astro-engine` | prune | small |

### Medium — depends on what you actually use
| # | Item | Question |
|---|---|---|
| B1 | **THREE cosmic-nexus deployments** on one box (`cosmic-nexus-v2` 7ct + `v2` 3ct + `cosmicnexus` 1ct) — confusing duplication | Which (if any) is still in production? You said the real Cosmic Nexus moved to 226.15. Are these all stale, or are 1–2 still needed for something? |
| B2 | `vedic-astro-engine` (4 ct, 2 exited) | Is `jyotish-engine` on `beacon-gom` the replacement? If so, this is stale. |
| B3 | `suna-deployment` (only rabbitmq alive, rest of stack gone) | Definitely stale (orphan rabbitmq). Remove the project + its volume? |
| B4 | `whisper-local` (5 months old) | Still used by `transcribe.aigniteconsulting.ai`? If yes, keep. If no, retire. |
| B5 | `/root/docker-compose.yml` | What is this? May be another stale stack. |
| B6 | `primepath-hr` stack (6 ct healthy, but `primepathhr.ai` 404) | Fix routing, or retire? |
| B7 | `analogguard` (4 months old, working) | Active product? |
| B8 | CloudPanel's `app` site (`/home/clp/htdocs/app`) | What is it? May or may not still serve anything. |

### Low — keep
- `aigniteconsulting` (live, 2-day uptime)
- `traefik` (infra)
- `shanu_pro_fixed` (live, serving shanulankatours.com)

---

## Suggested cleanup order (if you authorize)

1. **Phase 1 (lossless):** prune 5 exited containers, remove 5 orphan volumes, delete the Dec-2025 whisper backup directory. ~Zero risk, ~35-200 MB reclaim.
2. **Phase 2 (verify-then-remove):** for each B-item, I check what (if anything) currently routes to it externally, then ask you go/no-go on retirement.
3. **Phase 3 (fix or remove):** primepathhr.ai routing — fix Traefik label OR delete the stack + DNS record.

Want me to start with Phase 1 (lossless)?
