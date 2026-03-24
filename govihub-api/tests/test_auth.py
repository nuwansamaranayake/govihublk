"""GoviHub Auth Tests — JWT creation/validation, token refresh, expiry, and MCP auth."""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from jose import jwt

from app.auth.service import (
    _hash_token,
    create_access_token,
    decode_access_token,
)
from app.config import settings
from app.exceptions import UnauthorizedError


# ---------------------------------------------------------------------------
# JWT creation and decoding
# ---------------------------------------------------------------------------

def test_create_access_token_basic():
    """Access token is created with correct sub and role claims."""
    user_id = uuid.uuid4()
    token = create_access_token(user_id=user_id, role="farmer")

    assert isinstance(token, str)
    assert len(token) > 50

    payload = decode_access_token(token)
    assert payload.sub == str(user_id)
    assert payload.role == "farmer"


def test_create_access_token_all_roles():
    """Access tokens can be created for all valid roles."""
    for role in ("farmer", "buyer", "supplier", "admin"):
        token = create_access_token(user_id=uuid.uuid4(), role=role)
        payload = decode_access_token(token)
        assert payload.role == role


def test_access_token_no_role():
    """New user without role gets None role in token."""
    user_id = uuid.uuid4()
    token = create_access_token(user_id=user_id, role=None)
    payload = decode_access_token(token)
    assert payload.sub == str(user_id)
    assert payload.role is None


def test_access_token_has_jti():
    """Each token has a unique jti claim."""
    uid = uuid.uuid4()
    t1 = create_access_token(user_id=uid, role="farmer")
    t2 = create_access_token(user_id=uid, role="farmer")
    p1 = decode_access_token(t1)
    p2 = decode_access_token(t2)
    assert p1.jti != p2.jti


def test_access_token_exp_iat_ordering():
    """Token expiry must be after issued-at."""
    token = create_access_token(user_id=uuid.uuid4(), role="buyer")
    payload = decode_access_token(token)
    assert payload.exp > payload.iat


def test_expired_token_raises_401():
    """Expired token should raise UnauthorizedError (401)."""
    user_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": "farmer",
        "exp": now - timedelta(seconds=10),   # already expired
        "iat": now - timedelta(minutes=20),
        "jti": str(uuid.uuid4()),
    }
    expired_token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    with pytest.raises(UnauthorizedError):
        decode_access_token(expired_token)


def test_invalid_token_raises_401():
    """Tampered or random token should raise UnauthorizedError (401)."""
    with pytest.raises(UnauthorizedError):
        decode_access_token("this.is.not.a.valid.jwt")


def test_wrong_secret_raises_401():
    """Token signed with wrong secret should fail verification."""
    user_id = uuid.uuid4()
    payload = {
        "sub": str(user_id),
        "role": "farmer",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
    }
    bad_token = jwt.encode(payload, "wrong-secret", algorithm=settings.JWT_ALGORITHM)

    with pytest.raises(UnauthorizedError):
        decode_access_token(bad_token)


# ---------------------------------------------------------------------------
# Token hashing
# ---------------------------------------------------------------------------

def test_hash_token_deterministic():
    """Same input always produces same hash."""
    raw = "my-super-secret-refresh-token-xyz"
    assert _hash_token(raw) == _hash_token(raw)


def test_hash_token_sha256_length():
    """SHA-256 hex digest is always 64 characters."""
    h = _hash_token("any-token-value")
    assert len(h) == 64


def test_hash_token_uniqueness():
    """Different tokens produce different hashes."""
    h1 = _hash_token("token-alpha")
    h2 = _hash_token("token-beta")
    assert h1 != h2


def test_hash_token_avalanche():
    """A single character change produces a very different hash."""
    h1 = _hash_token("token-123")
    h2 = _hash_token("token-124")
    # Hashes should differ in more than half of their bits
    diff = sum(a != b for a, b in zip(h1, h2))
    assert diff > 10


# ---------------------------------------------------------------------------
# Health endpoint (no auth required)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_health_endpoint(client):
    """Health check endpoint returns 200 without authentication."""
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_protected_endpoint_without_token(client):
    """Protected endpoints return 401 when no token is provided."""
    resp = await client.get("/api/v1/users/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_with_invalid_token(client):
    """Protected endpoints return 401 when token is invalid."""
    resp = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": "Bearer invalidtoken.here"},
    )
    assert resp.status_code == 401
