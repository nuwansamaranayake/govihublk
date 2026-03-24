# Prompt 03 — Authentication Module (Google OAuth + JWT)

## Context
Prompts 01-02 established scaffolding and database models. Now we implement authentication.

## Objective
Build the complete auth module: Google OAuth 2.0 login flow, JWT token management (access + refresh), role-based access control middleware, and all auth-related API endpoints.

## Design Decisions
- **Google OAuth only**: No username/password. No phone OTP for auth (phone is collected in profile for SMS notifications only).
- **Flow**: Frontend redirects to Google → Google returns auth code → Frontend sends code to `/api/v1/auth/google` → Backend exchanges code for tokens, creates/finds user, returns JWT pair.
- **New users**: First Google login creates a user record. Role selection happens in a separate registration step (`/api/v1/users/complete-registration`).
- **JWT**: Access token (15 min, in memory on client), Refresh token (30 days, httpOnly cookie + stored in DB).

## Instructions

### 1. app/auth/schemas.py

Pydantic v2 models:
- `GoogleAuthRequest`: code (str), redirect_uri (str)
- `TokenResponse`: access_token, token_type ("bearer"), expires_in (int seconds), user (UserBrief)
- `UserBrief`: id, name, email, role (nullable — null for new users), avatar_url, language
- `RefreshTokenRequest`: (empty — token comes from httpOnly cookie)
- `TokenPayload`: sub (user_id as str), role, exp, iat, jti (unique token ID)

### 2. app/auth/service.py

**GoogleAuthService** class:
- `exchange_code(code, redirect_uri)` → Exchanges auth code with Google for id_token. Uses httpx to call `https://oauth2.googleapis.com/token`. Validates id_token. Returns Google user info (google_id, email, name, picture).
- `find_or_create_user(google_info)` → Checks `GoogleAccount` table for existing google_id. If found, returns linked User (update last_login_at). If not found, creates new User (role=None, is_verified=False) + GoogleAccount. Returns (user, is_new).
- `create_tokens(user)` → Creates JWT access token (15 min) and refresh token (30 days). Stores refresh token in DB. Returns TokenResponse.
- `refresh_access_token(refresh_token_str)` → Validates refresh token from DB (not expired, not revoked). Creates new access token. Returns TokenResponse.
- `revoke_refresh_token(token_str)` → Marks refresh token as revoked in DB.
- `revoke_all_user_tokens(user_id)` → Revokes all refresh tokens for a user.

**JWT helpers**:
- `create_access_token(user_id, role)` → Signs JWT with HS256, includes sub, role, exp, iat, jti
- `decode_access_token(token)` → Validates and decodes. Raises on expiry/invalid.

### 3. app/auth/router.py

Endpoints (prefix: `/api/v1/auth`):

```
POST /auth/google          — Exchange Google auth code for JWT tokens
POST /auth/refresh          — Refresh access token using httpOnly cookie
POST /auth/logout           — Revoke refresh token, clear cookie
GET  /auth/me               — Get current user from access token (lightweight)
```

`POST /auth/google`:
- Accepts `GoogleAuthRequest`
- Calls `GoogleAuthService.exchange_code()` then `find_or_create_user()` then `create_tokens()`
- Sets refresh token as httpOnly, secure, sameSite=lax cookie
- Returns `TokenResponse` (access token in body, refresh in cookie)
- If is_new=True, include `registration_required: true` in response

`POST /auth/refresh`:
- Reads refresh token from cookie
- Calls `refresh_access_token()`
- Returns new `TokenResponse`

`POST /auth/logout`:
- Reads refresh token from cookie
- Calls `revoke_refresh_token()`
- Clears cookie
- Returns `{message: "Logged out"}`

`GET /auth/me`:
- Requires valid access token
- Returns `UserBrief`

### 4. app/dependencies.py — Implement Auth Dependencies

**`get_current_user`**: 
- Extract Bearer token from Authorization header
- Decode JWT
- Query User from DB by sub (user_id)
- Raise 401 if token invalid/expired or user not found
- Return User object

**`get_current_active_user`**:
- Depends on `get_current_user`
- Check `is_active = True`
- Raise 403 if inactive

**`require_role(*allowed_roles)`**:
- Returns a dependency function
- Depends on `get_current_active_user`
- Check `user.role in allowed_roles`
- Raise 403 if role not allowed
- Usage: `Depends(require_role("admin"))`, `Depends(require_role("farmer", "admin"))`

**`require_registration_complete`**:
- Depends on `get_current_active_user`
- Check `user.role is not None`
- Raise 403 with `{error_code: "REGISTRATION_INCOMPLETE"}` if role is None

### 5. Security Considerations

- Refresh tokens: SHA256 hash stored in DB, not plain text
- Access tokens: Short-lived (15 min), not stored anywhere server-side
- CORS: Only allow configured origins
- Cookie settings: httpOnly=True, secure=True (HTTPS only), sameSite="lax", path="/api/v1/auth"
- Rate limit auth endpoints: max 10 requests/minute per IP (enforce in nginx, document here)
- Google token validation: Verify `aud` matches GOOGLE_CLIENT_ID, verify `iss` is accounts.google.com

### 6. Register Auth Router in main.py

Uncomment the auth router import and include:
```python
from app.auth.router import router as auth_router
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
```

## Verification

1. `app/auth/router.py` has 4 endpoints
2. `app/auth/service.py` has GoogleAuthService with all methods
3. `app/dependencies.py` has working `get_current_user`, `require_role`
4. JWT creation and decoding works (unit test)
5. Refresh token is stored as hash, not plaintext
6. Cookie settings are secure

## Output Report
Write report to: `/home/claude/govihub-prompts/reports/REPORT_03_AUTH.md`
