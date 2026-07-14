# ROLE_CHANGE_AUDIT.md — Phase 0 Audit

**Date:** 2026-07-14
**Investigator:** Claude Code (systematic-debugging, root-cause-first)
**Reported symptom:** "Change Your Role" modal on spices.govihublk.com fails with **"Not Found"** when a user (Buyer→Farmer, mobile) taps confirm.
**Task hypothesis (from CC_ROLE_CHANGE.md):** "The frontend calls a role-change endpoint that the backend never implemented. The modal is frontend-only."

> ## Verdict: the task's hypothesis is WRONG.
> The backend endpoint **exists and is live in production.** The "Not Found" is a **one-line frontend URL double-prefix bug**, reproduced at the production edge. However, the *existing* endpoint does **not** satisfy the locked business rules (it deletes profiles, has no cooldown, no active-match block, and does not reissue tokens), so the feature is still genuinely incomplete.

---

## 0.1 — What the frontend actually calls

`govihub-web/src/components/ui/ChangeRoleModal.tsx:35-45`

```js
const res = await fetch(
  `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002"}/api/v1/users/me/role`,
  { method: "PUT", headers: {..., Authorization: `Bearer ${token}`}, body: JSON.stringify({ new_role: selectedRole }) }
);
if (!res.ok) {
  const data = await res.json().catch(() => null);
  throw new Error(data?.detail || `Failed to change role (${res.status})`);   // <-- "Not Found" comes from data.detail
}
```

- **Method/body:** `PUT`, `{ "new_role": "farmer" | "buyer" | "supplier" }`
- **Error render:** shows `data.detail` verbatim → the raw `"Not Found"` string the user saw.
- **The bug:** it builds the URL by appending `/api/v1/...` onto `NEXT_PUBLIC_API_URL`, assuming that env var is a **bare origin**.

## 0.2 — The backend DOES have the route

`govihub-api/app/main.py:237` → `users_router` mounted at `/api/v1/users`.
`govihub-api/app/users/router.py:59` → `@router.put("/me/role")` → **full path `PUT /api/v1/users/me/role`**.

Confirmed against the **running production container** (`govihub-spices-govihub-api-spices-1`) via route introspection:

```
ROLE_ROUTES: [(['PUT'], '/api/v1/users/me/role')]
TOTAL_ROUTES: 142
```

Introduced in commit `05d205f` (2026-03-26 "feat: add Change Role feature — backend + frontend + i18n"), refined in `c0ae9e1` (2026-04-21). Deployed image built 2026-05-11 → **the route is baked in.** Deployment-lag was ruled out.

## 0.3 — Reproduction at the production edge (curl is blocked locally; probed via urllib on the VPS)

```
GET  https://spices.govihublk.com/api/v1/health                     -> 200
PUT  https://spices.govihublk.com/api/v1/users/me/role              -> 401 {"error":{"code":"UNAUTHORIZED",...}}   (route EXISTS, needs auth)
PUT  https://spices.govihublk.com/api/v1/api/v1/users/me/role       -> 404 {"detail":"Not Found"}                   (EXACT user symptom)
GET  https://spices.govihublk.com/api/v1/users/me                   -> 401 {"error":{"code":"UNAUTHORIZED",...}}
```

**Root cause, traced to source:**
- Prod build arg (`docker-compose.spices.yml:32`): `NEXT_PUBLIC_API_URL = https://spices.govihublk.com/api/v1` — **already ends in `/api/v1`.**
- App convention (`lib/api.ts:6`, `app/api/auth/callback/route.ts:3`): `API_BASE = NEXT_PUBLIC_API_URL`; callers append only the resource path (`/users/me`). → login, listings, etc. all work.
- **`ChangeRoleModal.tsx` is the only outlier** — it appends a *second* `/api/v1`. Fired URL becomes `…/api/v1/api/v1/users/me/role` → Starlette returns default `{"detail":"Not Found"}` (unmatched route bypasses the app's `{"error":{...}}` handler) → modal shows "Not Found".

## 0.4 — Database state (prod DB `govihub_spices`, container `govihub-spices-postgres-spices-1`)

| Check | Result |
|---|---|
| `users.role` distribution | farmer 50, buyer 26, supplier 19, admin 6 |
| `users.last_role_change_at` column | **absent** (migration genuinely needed) |
| `role_changes` table | **absent** (`to_regclass` = NULL) |
| `matches` by status | proposed 6, accepted 1 (→ active-match block is testable on real data) |

## 0.5 — Where the feature is surfaced / advertised

- Modal i18n keys exist in **all three** locales — `en.json`, `si.json`, **`ta.json`** at lines ~497-501 (`changeRoleTitle`, `changeRoleWarning`, `changeRoleConfirm`, `roleDesc*`). → Tamil **is** in scope for the copy rewrite.
- Referenced in `docs/audits/SPICES_FEATURE_INVENTORY.md`.
- No in-app Help page or Farmer Guide section for role-change exists yet (to be created in Phase 4).

## 0.6 — What's actually broken vs. what was reported

| Layer | Task assumed | Reality |
|---|---|---|
| Frontend path | `POST /users/me/change-role` | `PUT /api/v1/users/me/role` (double-prefixed → 404) |
| Backend route | never implemented | **implemented & live** (`PUT /me/role`) |
| Container names | `govihub-api-spices`, `govihub-db-spices` | `govihub-spices-govihub-api-spices-1`, `govihub-spices-postgres-spices-1` |
| DB name | `govihub_spices` (user `govihub`) | correct ✓ |
| Local tooling | `curl` | **blocked by context-mode** — used sandbox/urllib-on-VPS instead |

### Gap between the LIVE endpoint and the LOCKED decisions

The existing `change_role` (`router.py:59-187`) currently:
- ❌ **DELETES** the old role's profile (`router.py:82-94`) — violates **Decision 4** (must KEEP it).
- ❌ No **30-day cooldown** — violates **Decision 2**.
- ❌ No **active-match block** — violates **Decision 1** (it cancels listings and proceeds regardless).
- ❌ Does **not reissue tokens** — frontend redirects to the new dashboard on a **stale role claim** → likely breaks the new-role session.
- ❌ No `role_changes` audit row, no eligibility endpoint, no success notification.
- ✔️ Rejects same-role and admin; ✔️ cancels old listings; ✔️ single-transaction with rollback.

**Therefore the fix is:** (a) 1-line frontend URL fix, **and** (b) *modify the existing* `PUT /me/role` to satisfy the locked decisions — **NOT** create a new `POST /change-role`. Keep frontend and backend on the existing path; record `PUT /users/me/role` in the API contract doc.

---

## Corrected implementation plan (supersedes the paths/names in CC_ROLE_CHANGE.md)

1. **Migration** (prod `govihub_spices`, snapshot first): add `users.last_role_change_at` + `role_changes` table. *(Task Phase 1 as-is, just correct container/DB names.)*
2. **Backend** — modify `PUT /api/v1/users/me/role` (do not add a duplicate endpoint): remove the profile DELETE (keep the row, upsert-empty the target), add cooldown (429), active-match block (409), reissue access+refresh tokens with the new role claim, insert `role_changes`, create success notification, return `{ok, role, listings_deactivated, access_token, refresh_token}`. Add `GET /api/v1/users/me/role-change-eligibility`.
3. **Frontend** — fix the double-prefix (align to `lib/api.ts` convention: base already has `/api/v1`), pre-check eligibility on modal open, render server `message` for 400/409/429, store new tokens + redirect on 200. Kill the raw-"Not Found" path.
4. **Copy** — rewrite modal strings + add Help + Farmer Guide sections, EN + SI + **TA**, via gemini-translate.
5. **API contract doc** — record `PUT /users/me/role` and the eligibility GET.
6. **Test + deploy** — curl-suite A–K (via sandbox/VPS), Playwright 1–6, cross-role regression; snapshot → migrate → verify table count → rebuild → smoke test.

## Open decision for the manager (surfaced because the premise changed)

Real users are **blocked right now** by the trivial 1-line frontend bug, but the endpoint behind it currently **deletes profile data** and issues a stale token. Sequencing options in the reply.
