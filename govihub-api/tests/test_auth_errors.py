"""Auth error responses must carry a stable `code` so the frontend can localize them
and support can trace a complaint in any language. See docs/api/auth-errors.md.

Requires APP_ENV=beta|development (beta router). Run with -e APP_ENV=development.
"""

import uuid

import pytest

_REG = {
    "password": "Test123!", "name": "T", "role": "farmer",
    "district": "Colombo", "language": "en", "phone": "+94771234567",
}


@pytest.mark.asyncio
async def test_register_duplicate_username_returns_code(client, db_session):
    body = {**_REG, "username": "errdup" + uuid.uuid4().hex[:8]}
    r1 = await client.post("/api/v1/auth/beta/register", json=body)
    assert r1.status_code in (200, 201), r1.text
    r2 = await client.post("/api/v1/auth/beta/register", json=body)
    assert r2.status_code == 409
    assert r2.json()["detail"]["code"] == "USERNAME_TAKEN"


@pytest.mark.asyncio
async def test_login_wrong_password_returns_code(client, db_session):
    u = "errlogin" + uuid.uuid4().hex[:8]
    reg = await client.post("/api/v1/auth/beta/register", json={**_REG, "username": u})
    assert reg.status_code in (200, 201), reg.text
    r = await client.post("/api/v1/auth/beta/login", json={"username": u, "password": "WRONG"})
    assert r.status_code == 401
    assert r.json()["detail"]["code"] == "INVALID_CREDENTIALS"
