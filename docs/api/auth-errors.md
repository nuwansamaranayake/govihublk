# API Contract — Auth Error Codes

Registration/login errors carry a **stable `code`** so the UI can localize them and
support can trace a complaint in **any language** by its code. Verified on `spices` (2026-07-14).

## Response shapes the frontend understands
- **Business error:** `{"detail": {"code": "USERNAME_TAKEN", "message": "..."}}` (409/401/403/429)
- **Field validation:** `{"detail": [{"field": "username", "code": "TOO_SHORT", "message": "..."}]}` (422)
- Older endpoints may still return `{"detail": "plain string"}` (handled as a fallback).

The frontend (`beta-login/page.tsx` → `localizeAuthError`) maps `code` → an `auth.auth_error_*`
message in EN/SI/TA. An **unknown code** shows a generic localized message that **includes the
code** (`auth_error_generic` → "…(Ref: {code})"), so nothing is ever a dead end and support can
always identify the cause.

## Codes (registration + login)

| Code | HTTP | Meaning | i18n key |
|---|---|---|---|
| `USERNAME_TAKEN` | 409 | Username exists (usernames are globally unique) | `auth_error_username_taken` |
| `ROLE_ACCOUNT_EXISTS` | 409 | Caller already has an account for that role/email | `auth_error_role_account_exists` |
| `MAX_ACCOUNTS` | 409 | 3-accounts-per-email cap reached | `auth_error_max_accounts` |
| `INVALID_CREDENTIALS` | 401 | Wrong username or password (login) | `auth_error_invalid_credentials` |
| `ACCOUNT_INACTIVE` | 403 | Account deactivated | `auth_error_account_inactive` |
| `RATE_LIMITED` | 429 | Too many attempts (reserved; not yet emitted) | `auth_error_rate_limited` |
| _any unmapped_ | * | Generic + shows the code | `auth_error_generic` |

Username field-validation codes (live check + 422): `REQUIRED`, `TOO_SHORT`, `TOO_LONG`,
`HAS_SPACE`, `INVALID_CHARS`, `TAKEN` → `auth.username_error_<lowercased>`.

## Consistency
All `auth_error_*` and the client validation keys exist in **en/si/ta**. Phone input stores
E.164 (spaces are display-only; server `normalize_phone` strips them). The error banner scrolls
into view on failure so it is never rendered off-screen on the long registration form.

## Follow-ups (not done here)
- `RATE_LIMITED` code is defined but the rate-limit path (`beta_router:220`) still returns a raw
  string — wire it when touched.
- Tamil `auth` namespace still lacks some **non-error** labels (this change added the error keys +
  the 7 that were missing); a full Tamil `auth` pass is a separate task.
