"""GoviHub User Tests — Registration, profile updates, role-based access."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio

from app.auth.service import create_access_token
from app.users.models import User, UserRole


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# User profile retrieval
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_own_profile_farmer(client, farmer_user):
    """Farmer can fetch their own profile."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.get("/api/v1/users/me", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(farmer_user.id)
    assert data["role"] == "farmer"
    assert data["email"] == farmer_user.email


@pytest.mark.asyncio
async def test_get_own_profile_buyer(client, buyer_user):
    """Buyer can fetch their own profile."""
    token = create_access_token(user_id=buyer_user.id, role="buyer")
    resp = await client.get("/api/v1/users/me", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "buyer"


@pytest.mark.asyncio
async def test_get_own_profile_supplier(client, supplier_user):
    """Supplier can fetch their own profile."""
    token = create_access_token(user_id=supplier_user.id, role="supplier")
    resp = await client.get("/api/v1/users/me", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "supplier"


@pytest.mark.asyncio
async def test_get_profile_unauthenticated(client):
    """Unauthenticated request to /users/me returns 401."""
    resp = await client.get("/api/v1/users/me")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Profile update
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_own_profile_name(client, farmer_user):
    """Farmer can update their display name."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.patch(
        "/api/v1/users/me",
        json={"name": "Updated Farmer Name"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Farmer Name"


@pytest.mark.asyncio
async def test_update_own_profile_language(client, farmer_user):
    """User can update their preferred language."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.patch(
        "/api/v1/users/me",
        json={"language": "ta"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["language"] == "ta"


@pytest.mark.asyncio
async def test_update_farmer_profile_details(client, farmer_user):
    """Farmer can update their farmer-specific profile fields."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.patch(
        "/api/v1/users/me",
        json={
            "farmer_profile": {
                "farm_size_acres": 10.5,
                "irrigation_type": "flood",
            }
        },
        headers=_auth(token),
    )
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Role-based access
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_only_endpoint_denied_for_farmer(client, farmer_user):
    """Admin-only endpoint returns 403 for farmer role."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.get("/api/v1/admin/dashboard", headers=_auth(token))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_only_endpoint_denied_for_buyer(client, buyer_user):
    """Admin-only endpoint returns 403 for buyer role."""
    token = create_access_token(user_id=buyer_user.id, role="buyer")
    resp = await client.get("/api/v1/admin/dashboard", headers=_auth(token))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_list_users(client, admin_user):
    """Admin user can access the admin users list."""
    token = create_access_token(user_id=admin_user.id, role="admin")
    resp = await client.get("/api/v1/admin/users", headers=_auth(token))
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# User model unit tests
# ---------------------------------------------------------------------------

def test_user_role_enum_values():
    """UserRole enum contains all expected values."""
    roles = {r.value for r in UserRole}
    assert roles == {"farmer", "buyer", "supplier", "admin"}


def test_user_creation_minimal(db_session):
    """User can be instantiated with minimal required fields."""
    user = User(
        id=uuid.uuid4(),
        email="test@example.lk",
        name="Test Person",
        role=UserRole.farmer,
        is_active=True,
        is_verified=False,
    )
    assert user.email == "test@example.lk"
    assert user.role == UserRole.farmer
    assert user.is_active is True
