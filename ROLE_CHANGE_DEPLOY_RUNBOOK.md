# Role-Change — Production Deploy Runbook

**Target:** `spices.govihublk.com` on VPS `govihub-mumbai`, repo `/opt/govihub-spices`.
**Correct names** (task's were wrong): API container `govihub-spices-govihub-api-spices-1`,
DB container `govihub-spices-postgres-spices-1`, DB `govihub_spices`, compose service
names `govihub-api-spices` / `govihub-web-spices`, compose file `docker-compose.spices.yml`.
**Migration:** prod head is `012` → apply `013` (additive: `users.last_role_change_at` + `role_changes`).
Code is pushed to `origin/spices` (HEAD `2837e8e`); VPS repo is at `f150163` and must pull.

> Rebuilding `govihub-web-spices` and `govihub-api-spices` causes a brief outage for
> active users (Next.js/gunicorn images rebuild from scratch). The web MUST rebuild —
> the modal fix + i18n are baked at build time. Pick a low-traffic window.

## Steps (run on govihub-mumbai)

```bash
cd /opt/govihub-spices

# 1. Pull the verified code
git fetch origin && git checkout spices && git pull origin spices   # -> 2837e8e

# 2. SNAPSHOT prod DB first (mandatory; ~101 users)
docker exec govihub-spices-postgres-spices-1 pg_dump -U govihub govihub_spices \
  > ~/backups/spices-pre-rolechange-$(date +%Y%m%d-%H%M%S).sql
ls -la ~/backups/spices-pre-rolechange-*.sql | tail -1     # verify non-zero size

# 3. Record pre-migration table count
docker exec govihub-spices-postgres-spices-1 psql -U govihub -d govihub_spices -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"   # note N

# 4. Build new images (no cache)
docker compose -f docker-compose.spices.yml build --no-cache govihub-api-spices govihub-web-spices

# 5. Apply migration 013 using the NEW api image (before serving)
docker compose -f docker-compose.spices.yml run --rm govihub-api-spices alembic upgrade head

# 6. Verify migration: table count = N+1, role_changes + column exist, head=013
docker exec govihub-spices-postgres-spices-1 psql -U govihub -d govihub_spices -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"          # expect N+1
docker exec govihub-spices-postgres-spices-1 psql -U govihub -d govihub_spices -tAc \
  "SELECT to_regclass('public.role_changes');"                                           # role_changes
docker exec govihub-spices-postgres-spices-1 psql -U govihub -d govihub_spices -tAc \
  "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='last_role_change_at';"
docker exec govihub-spices-postgres-spices-1 psql -U govihub -d govihub_spices -tAc \
  "SELECT version_num FROM alembic_version;"                                             # 013

# 7. Recreate the running services
docker compose -f docker-compose.spices.yml up -d govihub-api-spices govihub-web-spices

# 8. Smoke test (curl is blocked locally — run from the VPS via python/urllib)
python3 - <<'PY'
import urllib.request, urllib.error
b="https://spices.govihublk.com"
def p(m,u,d=None):
    r=urllib.request.Request(u,method=m,data=(d.encode() if d else None),headers={"Content-Type":"application/json"})
    try: return f"{m} {u} -> {urllib.request.urlopen(r,timeout=10).status}"
    except urllib.error.HTTPError as e: return f"{m} {u} -> {e.code} {e.read(120).decode(errors='replace')}"
print(p("GET", b+"/api/v1/health"))                                    # 200
print(p("PUT", b+"/api/v1/users/me/role", '{"new_role":"farmer"}'))    # 401 (route live, needs auth)
print(p("GET", b+"/api/v1/users/me/role-change-eligibility"))          # 401 (route live)
PY
```

## Post-deploy (with a real beta token) — curl-suite A–K from CC_ROLE_CHANGE.md
Adapted to `PUT /users/me/role` (not the task's `POST /change-role`). Playwright flows 1–6
against prod. Cross-role isolation regression 076–077. Log to `ROLE_CHANGE_DEPLOY.log`.

## Rollback
Migration is additive — leave in place. Rollback = `git checkout f150163` and rebuild the
two images. Restore the snapshot only on data corruption. The additive column/table are inert
if the old code runs.
