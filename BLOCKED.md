# BLOCKED — needs the manager

## Nothing is currently blocked.

The git push that sat here is **resolved**. On 2026-08-25 the manager authorized
`git push origin spices`; local, `origin` and `/opt/govihub-spices` are all at the same commit and
the VPS tree is clean apart from two deliberate exceptions (below).

---

## Standing notes

### Admin password location

Rotated 2026-08-24. The old value returns 401. The live value exists in exactly one place:

```
/opt/govihub-spices/.env.spices   ->   GOVIHUB_ADMIN_PW   (on govihub-mumbai)
```

Test harnesses need it exported before they run:

```bash
ssh govihub-mumbai 'grep ^GOVIHUB_ADMIN_PW= /opt/govihub-spices/.env.spices'
```

### Two files on the VPS are intentionally uncommitted

`docker-compose.beta.yml` and `docker-compose.dev.yml` differ from git on `govihub-mumbai`. That
drift **predates** this work and is not in any commit. Both are backed up under `/root/backups/`.
Do not "reconcile" them without checking what the differences do first — the last time compose drift
was blindly reverted it would have re-exposed Postgres and Redis on all interfaces.

### Watch items — no action required

- **DB connections peaked at 83/100** under a 200-concurrent burst. Fine as configured. If the API
  worker count ever increases, raise Postgres `max_connections` to 200 **first**.
- **OpenRouter $5/week cap** — unchanged, manager already decided to leave it. If exhausted:
  moderation fails open (safe), crop diagnosis breaks visibly.
- **Mail is a catch-all.** Any address at `govihublk.com` lands in Resend and notifies
  `govihub.ai@gmail.com`. Spam to the catch-all will generate notifications.
- **District arrays disagree** across 5 files (25/25/21/25/18) — buyer settings is missing 4
  districts, supplier settings 7. Sri Lanka has 25. Pre-existing defect, unrelated to Tamil, and
  deliberately left alone. Worth its own small fix.
