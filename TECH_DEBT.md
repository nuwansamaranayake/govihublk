# GoviHub Technical Debt

Outstanding items from the 2026-04-21 whole-repo code review on the `spices` branch.
Severities preserved from the review. Fixed items are listed at the bottom for audit.

> Scan date: 2026-04-21
> Reviewer: Claude superpowers:code-reviewer
> Scope: 484 tracked files, commits `36e5800..8edc538`
> **Last updated:** 2026-04-22 — three deploy-blocker fixes landed (see bottom).

---

## Open — HIGH

### TD-H-01 — Admin `update_user` can write phones that violate 011 CHECK

**Severity:** HIGH
**Files:**
- `govihub-api/app/admin/schemas.py:80–90`
- `govihub-api/app/admin/service.py:212–225`

**Problem:** `AdminUserUpdate.phone` is `Optional[str]` with only `max_length=20`; no E.164 validator. After migration 011 landed, an admin-side phone edit on any non-admin user with a non-E.164 value will trigger `ck_users_phone_e164` and the flush will 500. The same endpoint also lets an admin flip a user's role from `admin → farmer` without checking the existing phone is E.164 — same CHECK violation.

**Fix sketch:**
1. Add `validate_e164_phone_optional` validator on `AdminUserUpdate.phone`.
2. In `AdminService.update_user`, when the role is being changed away from `admin`, validate that the new/existing phone is present and E.164-shaped before writing.

**Blast radius:** Low in practice — admin UI is pilot-only and Nuwan is the sole operator. Worth fixing before any additional admin is onboarded.

---

### TD-H-02 — MCP token leaks through SSE endpoint URL

**Severity:** HIGH
**Files:**
- `govihub-api/app/mcp/server.py:159–164, 200–215`

**Problem:** On `GET /mcp/sse?token=…`, the server advertises the POST endpoint back through the SSE stream as `/mcp/messages/<session_id>?token=<MCP_ADMIN_SECRET>`. Traefik access logs and any front-of-house logging capture the raw admin secret. The session-binding fix (trust `_SESSIONS` on the POST path) is correct, but since the URL still carries the secret, a log-scraped URL grants full takeover anyway.

**Fix sketch:** Generate a per-session short-lived token — `HMAC(session_id, MCP_ADMIN_SECRET)` — and put **that** in the advertised endpoint URL. Validate the HMAC on each POST. Alternatively, when the client authenticates via `Authorization` header on the SSE GET, strip `?token=` from the advertised URL entirely.

**Pilot-only exposure:** Attack surface today is Claude.ai's connector + Nuwan's MCP Inspector. Ticketed rather than patched this session because the proper design (per-session HMAC) deserves thought. **Must be patched before MCP reaches any third-party audience** (e.g. Gamini's farmer network or any public connector).

---

### TD-H-03 — MCP `govihub_get_match_performance` funnel reports zero-everything

**Severity:** HIGH
**Files:**
- `govihub-api/app/mcp/tools.py:1773–1805` (handler)
- `govihub-api/app/mcp/tools.py:419–423` (tool description)
- `govihub-api/app/mcp/tools.py:802–808` (`_handle_get_match_analytics`)

**Problem:** Handler reads `status_counts.get("confirmed", 0)`, `.get("fulfilled", 0)`, `.get("disputed", 0)`, `.get("rejected", 0)`. None of those are valid `match_status` values after migration 007 collapsed the lifecycle to `{proposed, accepted, completed, dismissed}`. The tool silently returns 0 for every historical bucket and 0 conversion rate. Admin-facing numbers are misleading.

**Fix sketch:** Rename buckets to the current enum, recompute conversion rates as `completed / accepted`, update the tool description string to the new lifecycle.

---

### TD-H-04 — Ads `/ads/active` ignores `target_districts`

**Severity:** HIGH (functional)
**Files:** `govihub-api/app/ads/router.py:88–120`

**Problem:** Advertisement has `target_districts` JSONB column and the Create/Update admin forms accept it, but the public query filters only by `target_roles`. A farmer in Galle sees ads targeted to Anuradhapura.

**Fix sketch:** Add the `.op("@>")` / `?|` JSONB filter against the user's district. Or drop the column and the admin form fields if per-district targeting isn't a product requirement.

**Blast radius:** None today (pilot only has a handful of ads, no district targeting used yet). Becomes real with sponsor ads for different regions.

---

## Open — MEDIUM

### TD-M-01 — `DashboardStats.disputed_matches` now counts all dismissed matches

**Severity:** MEDIUM
**Files:**
- `govihub-api/app/admin/service.py:111–116, 895–900`

**Problem:** Since 007 folded `disputed|cancelled|expired → dismissed`, the "disputed matches" KPI on the admin dashboard is a cancel/expire/dispute aggregate, not a dispute count.

**Fix sketch:** Either rename the field to `dismissed_matches` throughout (models + schema + frontend labels), or re-derive dispute count from a separate signal (e.g. notes starting with `[ADMIN RESOLVED]`).

---

### TD-M-02 — `POST /users/me/complete-profile` admin-rejection uses non-standard error shape

**Severity:** MEDIUM
**Files:** `govihub-api/app/users/router.py:207–208`

**Problem:** `raise HTTPException(status_code=400, detail="Admins do not use this endpoint")` returns `{"detail":"..."}`, not the platform contract `{"error":{"code","message","details"}}`. Frontend `api.ts` has fallback parsing so it works, but every other GoviHub error uses the nested shape.

**Fix sketch:** Use `ValidationError` (already imported in the module) so it flows through `govihub_exception_handler`.

---

### TD-M-03 — `AdCarousel` hardcodes "Sponsored" label

**Severity:** MEDIUM (i18n regression)
**Files:** `govihub-web/src/components/ads/AdCarousel.tsx:134`

**Problem:** `locale === "si" ? "දැන්වීම" : "Sponsored"` — Tamil users get English. Translation key `sponsored` already exists in `messages/*.json`.

**Fix sketch:** Switch to `useTranslations` like the rest of the component tree.

---

### TD-M-04 — `require_complete_profile` lets `role=None` through

**Severity:** MEDIUM (low exposure today)
**Files:** `govihub-api/app/dependencies.py:68–82`

**Problem:** A Google-auth user between OAuth callback and `/users/complete-registration` bypasses the phone requirement on endpoints that use `require_complete_profile` alone (`PUT /users/me/location`, `DELETE /users/me`, `GET /weather/forecast`). The weather endpoint accepts arbitrary lat/lng — a dangling pre-registration user can exercise it freely.

**Fix sketch:** Require `role is not None` inside `require_complete_profile`, or introduce a separate `require_completed_user` for endpoints that shouldn't serve pre-registration sessions.

---

### TD-M-05 — `_handle_govihub_get_user_activity` groups by user name

**Severity:** MEDIUM (data integrity)
**Files:** `govihub-api/app/mcp/tools.py:1483–1494`

**Problem:** Uses `most_active_users[name]` keyed on the display name. Two users named "Kamal Perera" merge into one bucket.

**Fix sketch:** Key by `user_id`, surface the name only for display.

---

### TD-M-06 — Admin `list_users` enum filter compares to raw string

**Severity:** MEDIUM (silent empty results)
**Files:** `govihub-api/app/admin/service.py:170`

**Problem:** `query.where(User.role == filters.role)` — `User.role` is `UserRole` enum, `filters.role` is raw string. SQLAlchemy Enum type coerces so it technically works, but inconsistent with `UserRole(value)` casts elsewhere (line 219). Invalid filter values silently return 0 rows.

**Fix sketch:** Cast `filters.role` to `UserRole(filters.role)` at the boundary to surface invalid values as 422.

---

### TD-M-07 — `_knowledge_to_dict` returns `None` for metadata on refreshed chunks

**Severity:** MEDIUM
**Files:** `govihub-api/app/admin/router.py:355–359`

**Problem:** Uses `chunk.__dict__.get("metadata")`. The ORM field is aliased as `metadata_`; `__dict__` returns `None` for freshly loaded objects that haven't populated instrumented state.

**Fix sketch:** `getattr(chunk, "metadata_", None)` per the `KnowledgeChunkRead` alias.

---

## Open — LOW

### TD-L-01 — Weather scheduler no jitter across workers

**Files:** `govihub-api/app/main.py:21–52`
Fine at current `-w 1`. If gunicorn scales up, duplicate alerts. Consider a Redis lock before scaling.

### TD-L-02 — Weather forecast cache shares across 1-km-separated farmers

**Files:** `govihub-api/app/weather/alert_engine.py:69`
`round(lat, 2)` cache key. Acceptable for Open-Meteo 11 km grid. Documented here rather than fixed.

### TD-L-03 — `mark_all_alerts_read` doesn't respect `expires_at`

**Files:** `govihub-api/app/weather/router.py:249–265`
Cosmetic — marks historical expired alerts read along with live ones.

### TD-L-04 — `.env.frontend` tracked despite `.gitignore` pattern `.env.*.local`

**Files:** `.env.frontend`
Contents are `NEXT_PUBLIC_*` placeholders — no secret leak. Contract is ambiguous though. Either rename to `.env.frontend.example` or add explicit gitignore entry.

### TD-L-05 — Pydantic request schemas lack `extra="forbid"`

**Files:** `govihub-api/app/users/schemas.py:12–25` (and sibling request DTOs)
Default `extra="ignore"` is how the `preferred_language` / `language` field-name bug (fix #3 this session) went undetected. Setting `extra="forbid"` on request schemas would have failed the client call fast with a 422.

### TD-L-06 — Dead imports in `ads/router.py`

**Files:** `govihub-api/app/ads/router.py:11, 17`
`bindparam` imported once but used in one place; `AdEventRequest` schema is unused. Remove to reduce surface.

---

## Open — NOTES (not tracked as debt)

- `MCP_ADMIN_SECRET` default `"change-me"` in `config.py:64`. `.env.spices.template` marks it `CHANGE_ME`. Consider a startup-time fatal check when `APP_ENV == "production"` and the secret still equals `"change-me"`.
- Migration 007 downgrade correctly recreates the pre-007 enum with all nine values and remaps. OK.
- Migration 008 downgrade would abort if prod has duplicate emails across roles (expected: many). Accept as designed — the whole point of 008 was to permit duplicates.
- `HarvestStatus` and `DemandStatus` enums still contain `cancelled`/`fulfilled` — listings/demand writes in `users/router.py:99–121` remain valid.
- CORS allowlist correctly driven by `ALLOWED_ORIGINS` env; prod has `https://spices.govihublk.com, https://govihublk.com, https://www.govihublk.com`.
- No `print()` calls logging PII in backend. No secrets (`sk_*`, `AKIA`, `AIza...`) committed.
- `docker-compose.spices.yml` gunicorn `-w 1 -k uvicorn.workers.UvicornWorker` matches scheduler design. Traefik `flushInterval=1ms` is MCP-critical and correct.

---

## Closed in this session

| Finding | Severity | Commit | Note |
|---|---|---|---|
| #1 `PUT /users/me/role` writing removed `cancelled` status | HIGH (deploy blocker) | `c0ae9e1` | Swapped to `dismissed` + `NOT IN (completed, dismissed)` in both farmer and buyer branches |
| #3 Register page sent `preferred_language` instead of `language` | CRITICAL | `1a3edcc` | Renamed field to match `CompleteRegistrationRequest` schema |
| #6 Migration 011 lacked pre-check guard against NULL non-admin phones | HIGH (deploy blocker) | `4c7fb68` | Added `DO $$ ... RAISE EXCEPTION` guard in `upgrade()` that fails with a readable message if any non-admin row has NULL/empty phone |
| Migration 011 applied to production | — | `8edc538` + `4c7fb68` | `alembic current = 011`, both CHECK constraints in place, 0 non-admin NULL phones, 9-row phone normalization complete, `nuwans` (test account) deleted |

---

## Bisectability note (informational, not debt)

Commits C1–C8 in the phone-mandatory rollout reference `require_complete_profile` which isn't defined until commit C9 (`f74f748`). The branch tip builds and deploys correctly; `git bisect run` across the intermediate commits would fail on import. Accepted tradeoff; no action required.
