# ADMIN_USERS_VERIFICATION.md

**Task:** Admin panel — server pagination, search, user edit (and close G2.6)
**Date:** 2026-08-23 · **Branch:** `spices` · **Commits:** `55f22cd`, `897b616`
**Spec:** `CC_ADMIN_USERS_PAGINATION_EDIT.md` · **State:** `/opt/govihub-spices/.cc_state/admin_users_edit.json`

**G2.6 is CLOSED.** GC 10/10, GP 8/8, baseline restored exactly. No migration.

---

## ⚠️ STEP 0 — the spec's premise was false, and so was my last report

This task was written to fix two defects. **Neither existed.** Verified against live production
*before* writing any code:

| Spec claim | Reality on prod |
|---|---|
| `/admin/users` fetches `?size=100` once, filters client-side | **False.** `loadUsers()` sends `page`, `size`, `search`, `role`, `is_active` as query params; the service does real `LIMIT/OFFSET` + `ILIKE` |
| Search returns 0 for real users | **False.** `search=nuwan` → **total=5**, the admin row present |
| ~half the base unreachable | **False.** `page=1&size=25` → **203 users, 9 pages**; a full page walk returns every id exactly once |
| The user detail modal has no editable fields | **False.** Every user row has an **Edit** button (`openEditUser`, admin.html:830) opening a modal with name / phone / role / district — present in the *deployed* build |

**What actually happened:** the previous session's Playwright agent opened the read-only **detail**
modal and never clicked the per-row **Edit** button. Its harness was also flaky — it self-reported a
duplicate-tab bug on the login page that silently reset forms. I relayed that conclusion without
challenging it.

**Corrected at source**, so no future session re-trusts it:
- `PHONE_FONT_VERIFICATION.md` — retraction banner at the top, both false claims struck through inline.
- `/opt/govihub-spices/.cc_state/phone_font_micro.json` — `CORRECTION_2026_08_23` field; task A blocker marked RETRACTED.

**Consequence for scope:** server pagination, server search, and the edit form were **not built** —
they already worked. Rebuilding them would have been churn and regression risk on a working
production panel. Only the genuine gaps shipped.

## What actually shipped

| Gap (real) | Fix |
|---|---|
| Search covered name/email/phone but **not username** | `User.username.ilike(pattern)` added to the OR |
| `size=500` → **422** | clamped to `MAX_USER_PAGE_SIZE = 100`; default 20 → 25 |
| Unknown fields **silently dropped** (pydantic `extra=ignore`) — a bad save looked successful | `model_config = {"extra": "forbid"}` → 422 naming the field |
| District was free text; API accepted anything | validated against the canonical 25 (`app.utils.sri_lanka.DISTRICTS`); panel field is now a `<select>` (25 + "(none)") |
| Errors surfaced only as a toast | inline `#edit-user-error` box in the edit modal |
| **Found during GP:** every rejection rendered as literal `[object Object]` | new `apiErrorMessage()` handles all three API error shapes |

**Empty district stays legal** — 6 production users have none, and editing them must not force one.
All 18 distinct district values in prod were verified to be canonical before adding validation, so
no existing user became uneditable.

### Role editing — reported, deliberately unchanged

Per instruction, role behaviour was **not touched**; these are facts, not changes:
- The panel **has a working role `<select>`** in the edit modal.
- `PUT /api/v1/admin/users/{id}` **accepts `role`, including `role: "admin"`** — measured live: 200.
- **The endpoint is admin-only.** `AdminRequired = Depends(require_role("admin"))`, confirmed live:
  unauthenticated → **401**, farmer token → **403**.

The earlier "role immutable" lock was written against the false report; removing a live admin
capability is a product decision, so nothing was removed.

## Gates — GC (API, prod)

```
GC.1  size=25 -> 25 items, pages == ceil(total/25)      total=204 pages=9
GC.2  full page walk: no duplicates, count == total     walked=204 unique=204
GC.3  search=nuwan -> admin row present                 total=5
GC.3  search by phone substring -> user found           total=1
GC.4  size=500 -> clamped                               200, size=100
GC.5  PUT {"username": ...} -> 422 naming it, DB unchanged
GC.6  clear a farmer's phone -> 422 with reason         (T2 regression intact)
      district "Atlantis" -> 422
GC.7  admin rows keep legal empty phones                5 of 6 empty (read-only observation)
      endpoint admin-only                               unauth 401 / farmer 403
RESULT 10 / 10
```

## Gates — GP (real panel UI, prod) — **G2.6 CLOSED**

All mutations on throwaway `agate530055`. **`nuwan` never touched.**

| Gate | Result | Evidence |
|---|---|---|
| GP.1 server-side search | PASS | panel fired `GET /admin/users?page=1&size=20&search=agate530055`; row visible |
| GP.2 pagination | PASS | "204 users"; 11 pages walked `[20×10, 4]` = 204; Next disabled on last, Prev on first |
| **GP.3 G2.6 negative** | **PASS** | `0771234567` → PUT **422**, inline error visible, modal stayed open, **DB unchanged** |
| **GP.4 G2.6 positive** | **PASS** | `+94771230099` + district `Matale` via the select + new name → PUT 200; persisted after reload; DB confirms all three |
| GP.5a suspend | PASS | `is_active=f`; login → 403 `ACCOUNT_INACTIVE` |
| GP.5b activate | PASS | `is_active=t`; login → 200 → farmer dashboard |
| GP.5c reset password | PASS | temp password surfaced in the panel (value withheld) |
| GP.6 screenshots | PASS | 11 captured, `e2e-v3/screenshots/admin-users/` |

DB trail for GP.3 / GP.4:
```
GP.3-before  agate530055 | Agate Test    | +94775300551 | Kandy
GP.3-after   agate530055 | Agate Test    | +94775300551 | Kandy    <- rejected, nothing written
GP.4-after   agate530055 | Agate Renamed | +94771230099 | Matale   <- all three saved
```

### The `[object Object]` defect, found and fixed mid-run

GP.3 passed the *rejection* but exposed that the message read literally `[object Object]` — making
the inline error box I had just added useless. Root cause: `apiFetch` did
`throw new Error(data.detail)`, and none of our three error shapes are strings:

```
FastAPI 422       detail: [ {loc, msg} | {field, code, message} ]
GoviHubException  detail: {code, message}   OR   error: {code, message}
plain             detail: "some string"
```

`apiErrorMessage(data, status)` now handles all of them. Re-verified live on **both** shapes:

```
array shape   -> "phone: Value error, Phone must be in international E.164 format, starting with
                  '+' and country code, e.g. +94771234567"
error-key     -> "Phone number is required for non-admin users and cannot be cleared."
```
No `[object Object]` in either box or toast; DB unchanged by both rejected attempts.
Screenshots: `fix_error_message.png`, `fix_error_message_empty.png`.

## Deploy — and a deploy trap worth remembering

- Snapshot: `/root/backups/spices-pre-adminusers-20260823-*.sql` (6,027,337 bytes). No migration.
- `docker compose build --no-cache govihub-api-spices govihub-spices-admin` → api rebuilt, **admin
  silently untouched**.

**`govihub-spices-admin` has no `build:` section.** It is `image: nginx:alpine` with a *single-file
bind mount* of `admin.html`. So `build --no-cache` is a no-op for it, and because `git pull`
atomically **replaces** the file, the inode binding breaks and the container keeps serving the old
content — it was still on the April image, 2 months up, with none of the changes. This is the
documented single-file-bind-mount trap.

**Fix: `docker compose up -d --force-recreate govihub-spices-admin`.** Verified afterwards by
grepping the *served* file inside the container for the new markers (`apiErrorMessage`, the district
`<select>`), not by assuming the deploy worked.

## Cleanup

FK-safe SQL, dry run (ROLLBACK) before COMMIT:
```
users      204 -> 203   (baseline restored exactly)
listings     7 ->   7
throwaway agate% left:  0
nuwan phone:  +94771234567   (untouched)
```

## Carried forward

- **Plaintext production admin credential in `e2e-v3/test-all.js:20`** — used again for these gates
  (read from file at runtime, never printed or written to results). Still the top security item.
- The Next.js login page does not populate the static panel's `sessionStorage` token, so the panel
  must be entered via its own login form at `/admin/`. Noted for future harnesses.
- Deferred, untouched: role/username editing changes, admin account creation, bulk actions, panel
  localization, credential rotation, Tamil pass, moderation spec.

## Rollback

No migration. `git revert 897b616 55f22cd`, then `up -d --force-recreate govihub-spices-admin` and
rebuild the api image. Snapshot above.
