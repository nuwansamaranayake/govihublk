# API Contract — Self-Service Role Change

Verified against the implementation on branch `spices` (2026-07-14). Frontend→backend
mapping confirmed live: the modal calls exactly these paths (see
[ChangeRoleModal.tsx](../../govihub-web/src/components/ui/ChangeRoleModal.tsx)).
Root-cause history and the corrected contract decision are in
[ROLE_CHANGE_AUDIT.md](../../ROLE_CHANGE_AUDIT.md).

> The frontend base `NEXT_PUBLIC_API_URL` **already includes** `/api/v1`
> (`docker-compose.spices.yml`). Callers append only the resource path
> (`/users/me/role`). The old modal appended a second `/api/v1` → 404.

## PUT /api/v1/users/me/role

Change the caller's own role. Auth: any non-admin user with a complete profile
(`require_complete_profile`; missing phone → 428 `PROFILE_INCOMPLETE`).

**Request**
```json
{ "new_role": "farmer" | "buyer" | "supplier" }
```

**200 OK**
```json
{
  "ok": true,
  "role": "farmer",
  "listings_deactivated": 3,
  "access_token": "<jwt with new role claim>",
  "refresh_token": "<opaque>"
}
```
Side effects (single transaction): old role's open listings deactivated
(farmer harvest→`cancelled`, buyer demand→`cancelled`, supplier supply→`discontinued`)
and their active matches → `dismissed`; the old role's profile row is **kept**;
the target profile row is created empty if missing; `users.last_role_change_at`
stamped; a `role_changes` audit row inserted; an in-app notification created;
all refresh tokens revoked and a fresh access+refresh pair minted.

**Errors** (all use the app envelope `{"error":{"code","message","details"}}`)

| Status | code | When | details |
|---|---|---|---|
| 400 | `ROLE_INVALID` | caller is admin, or `new_role` not farmer/buyer/supplier | — |
| 400 | `ROLE_SAME` | `new_role` == current role | — |
| 409 | `ACTIVE_MATCHES_EXIST` | caller has non-terminal matches on their current side | `{count}` |
| 429 | `ROLE_CHANGE_COOLDOWN` | last change < 30 days ago | `{retry_after_days, next_allowed_at}` |
| 428 | `PROFILE_INCOMPLETE` | non-admin without a phone | `{required_field:"phone"}` |

> **Active** = match `status IN ('proposed','accepted')` — the real `match_status`
> enum after migration 007 is `{proposed, accepted, completed, dismissed}`
> (the earlier spec's `confirmed`/`disputed` do not exist). Suppliers have no
> matches, so a supplier is never blocked by this rule.

## GET /api/v1/users/me/role-change-eligibility

Pre-flight state so the modal can show any block before the user taps confirm.
Same auth guard.

**200 OK**
```json
{
  "eligible": true,
  "active_matches": 0,
  "cooldown_ends_at": null,
  "reason": null
}
```
`reason` ∈ `null | "cooldown" | "active_matches" | "admin"`. When `reason == "cooldown"`,
`cooldown_ends_at` is the ISO timestamp the user may next change.

## Policy (locked)

- One change per **30 days**, enforced server-side.
- **Block** while any active match exists — user must fulfil or cancel/reject first.
- Scope: farmer ↔ buyer ↔ supplier only; admin is never source or target; new ≠ current.
- Old role's profile row is **retained**; deactivated listings are **not** auto-restored.
- Migration `013` is additive (one column + `role_changes` table); no destructive down-migration.
