# Hostinger VPS Inventory — 2026-05-22 (verified via DNS + HTTP probes)

## Key clarification: "Cosmic Nexus" refers to TWO different things

- **Cosmic Nexus brand site** (`cosmicnexus.ai`) → lives on `72.60.226.15` ✅ as user said
- **Cosmic Nexus product portfolio** (airshield, regpulse, floodpulse, recallwatch, beacon-gom, etc.) → actually lives on `82.197.95.191` as `*.aigniteconsulting.ai` subdomains, NOT on `72.60.226.15`

---

## VPS 1 — `srv453405` CloudPanel — `82.197.94.206`
KVM 4 · Ubuntu 22.04 · created 2023-12-17 · oldest box

**Verified live:**
| Domain | HTTP | Stack |
|---|---|---|
| aigniteconsulting.ai | 200 | Next.js |
| shanulankatours.com | 200 | Next.js |
| analogguard.com | 200 | Express |
| paylk.aigniteconsulting.ai | 200 | nginx |
| transcribe.aigniteconsulting.ai | 200 | TornadoServer |
| traefik.aigniteconsulting.ai | 401 | Traefik dashboard (auth-gated) |
| **primepathhr.ai** | **404** | BROKEN — needs a fix |
| nuwan.aigniteconsulting.ai | 404 | DNS only, no vhost |
| dinidu.aigniteconsulting.ai | 404 | DNS only, no vhost |

User's expectation ✅ confirmed for 3 of 4 named domains. **primepathhr.ai is down** (404, not configured in CloudPanel).

## VPS 2 — `srv1033016` n8n template — `82.197.95.191`
KVM 4 · Ubuntu 24.04 · created 2025-09-28 · **14 Docker projects (Cosmic Nexus product apps)**

**Verified live via *.aigniteconsulting.ai subdomains:**
| Subdomain | HTTP | Docker project | Notes |
|---|---|---|---|
| airshield | 200 | airshield (3 ct) | backend container unhealthy 8wk |
| floodpulse | 200 | floodpulse (5 ct) | healthy |
| recallwatch | 200 | recallwatch (4 ct) | healthy |
| n8n | 200 | root (n8n+traefik) | healthy |
| openclaw | 200 | openclaw-nuwan | healthy |
| gomsafety | 200 | beacon-gom | healthy |
| **regpulse** | **404** | regpulse (6 ct running) | nginx/traefik route broken |

**Docker projects with no DNS or unhealthy:**
- airshield-public-mcp, floodpulse-public-mcp, regscope-public-mcp (port 9510/9511/9520 — internal MCPs)
- drapestudio, jyotish-engine (no public subdomain visible)
- **swarnapali** — unhealthy 8wk, still serving on :5050
- **openclaw-k1zn** — looks like a duplicate of openclaw-nuwan

## VPS 3 — `srv1165547` plain Ubuntu — `72.60.226.15`
KVM 8 · Ubuntu 24.04 · created 2025-11-30 · biggest box (8 vCPU / 32 GB) · **Docker API blind**

**Verified live (cosmicnexus.ai brand surfaces):**
| Subdomain | HTTP | Notes |
|---|---|---|
| cosmicnexus.ai | 200 | brand site (nginx 1.29.5) |
| www.cosmicnexus.ai | 301→ apex | OK |
| new.cosmicnexus.ai | 200 | live |
| **api.cosmicnexus.ai** | **404** | DNS only |
| **mcp.cosmicnexus.ai** | **404** | DNS only |
| **preview.cosmicnexus.ai** | **404** | DNS only |
| **mobile.cosmicnexus.ai** | **403** | DNS only / forbidden |

Need SSH to inventory the actual nginx vhosts + services here.

## VPS 4 — `srv1337919` OpenClaw template — `72.60.170.53`
KVM 2 · created 2026-02-05 · smallest · single-purpose OpenClaw

**Question:** OpenClaw is also running on VPS 2 (`openclaw-nuwan`). Do you need both? Different users? Different purposes?

## VPS 5 — `srv1522543` Docker+Traefik — `187.127.135.82`
KVM 4 · created 2026-03-23 · **GoviHub box**

7 Docker projects (govihub-spices = active, govihub-beta = exited 4wk, walkforpeace + aignitelk + docs-govihub + opt umbrella + traefik). Unchanged from initial scan.

---

## Cleanup decision matrix (need your call on each)

| # | Item | VPS | Recommendation | Risk |
|---|---|---|---|---|
| 1 | `govihub-beta` (stopped 4wk) | 5 | **Remove** | Low — superseded by govihub-spices |
| 2 | `walkforpeace-frontend-*` (4 exited) | 5 | Verify first | Likely by-design build artifacts |
| 3 | `swarnapali` (unhealthy 8wk) | 2 | Decide | Is it still used? |
| 4 | `airshield-backend` (unhealthy 8wk) | 2 | Fix or retire | Frontend+DB still healthy |
| 5 | `openclaw-k1zn` (duplicate?) | 2 | Likely remove | Same image as openclaw-nuwan |
| 6 | OpenClaw on VPS 4 | 4 | Consolidate? | Single-purpose 2vCPU box |
| 7 | `nuwan/dinidu.aigniteconsulting.ai` 404 | 1 | Remove DNS records or stand up vhosts | DNS clutter |
| 8 | `primepathhr.ai` 404 | 1 | **Fix or remove** | Domain costs money, not serving |
| 9 | `regpulse.aigniteconsulting.ai` 404 | 2 | **Fix nginx/traefik route** | 6 containers running but unreachable |
| 10 | `api/mcp/preview/mobile.cosmicnexus.ai` 404 | 3 | Fix or remove DNS records | DNS without services |

## Open questions before I touch anything

1. **primepathhr.ai is down (404).** Known? Was there ever a vhost? Want me to SSH into CloudPanel and check?
2. **regpulse.aigniteconsulting.ai is down (404)** but 6 containers are running. Want me to investigate nginx/traefik routing?
3. **Did you intend** to move the product apps (airshield/regpulse/floodpulse/etc.) from `82.197.95.191` → `72.60.226.15`? Right now they live on the n8n box, and `72.60.226.15` is mostly empty.
4. **Do you want CloudPanel SSH inventory** for VPS 1 + plain-Ubuntu inventory for VPS 3? Docker Manager API can't see them.
5. **Hostinger Shared Hosting list is empty** — none of these are using managed hosting. All VPSs are self-managed.
