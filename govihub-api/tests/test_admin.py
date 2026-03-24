"""GoviHub Admin Tests — Admin-only access enforcement and dashboard stats."""

from __future__ import annotations

import uuid

import pytest

from app.auth.service import create_access_token


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Admin access enforcement
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_dashboard_requires_auth(client):
    """Admin dashboard endpoint requires authentication."""
    resp = await client.get("/api/v1/admin/dashboard")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_admin_dashboard_forbidden_farmer(client, farmer_user):
    """Farmer cannot access admin dashboard."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.get("/api/v1/admin/dashboard", headers=_auth(token))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_dashboard_forbidden_buyer(client, buyer_user):
    """Buyer cannot access admin dashboard."""
    token = create_access_token(user_id=buyer_user.id, role="buyer")
    resp = await client.get("/api/v1/admin/dashboard", headers=_auth(token))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_dashboard_forbidden_supplier(client, supplier_user):
    """Supplier cannot access admin dashboard."""
    token = create_access_token(user_id=supplier_user.id, role="supplier")
    resp = await client.get("/api/v1/admin/dashboard", headers=_auth(token))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_dashboard_accessible_to_admin(client, admin_user):
    """Admin user can access the dashboard endpoint."""
    token = create_access_token(user_id=admin_user.id, role="admin")
    resp = await client.get("/api/v1/admin/dashboard", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    # Dashboard should return structured statistics
    assert isinstance(data, dict)


@pytest.mark.asyncio
async def test_admin_users_list(client, admin_user, farmer_user, buyer_user):
    """Admin can list all users."""
    token = create_access_token(user_id=admin_user.id, role="admin")
    resp = await client.get("/api/v1/admin/users", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_admin_users_list_with_role_filter(client, admin_user):
    """Admin can filter users by role."""
    token = create_access_token(user_id=admin_user.id, role="admin")
    resp = await client.get("/api/v1/admin/users?role=farmer", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    # All returned users should be farmers
    for user in data["items"]:
        assert user["role"] == "farmer"


@pytest.mark.asyncio
async def test_admin_crops_list(client, admin_user, crop_taxonomy):
    """Admin can list crop taxonomy."""
    token = create_access_token(user_id=admin_user.id, role="admin")
    resp = await client.get("/api/v1/admin/crops", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data


@pytest.mark.asyncio
async def test_admin_create_crop(client, admin_user):
    """Admin can create a new crop taxonomy entry."""
    token = create_access_token(user_id=admin_user.id, role="admin")
    payload = {
        "code": f"NEW_{uuid.uuid4().hex[:6].upper()}",
        "name_en": "New Test Crop",
        "name_si": "නව අස්වැන්න",
        "category": "vegetable",
    }
    resp = await client.post(
        "/api/v1/admin/crops",
        json=payload,
        headers=_auth(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name_en"] == "New Test Crop"


@pytest.mark.asyncio
async def test_admin_analytics_matches(client, admin_user):
    """Admin can retrieve match analytics."""
    token = create_access_token(user_id=admin_user.id, role="admin")
    resp = await client.get(
        "/api/v1/admin/analytics/matches",
        headers=_auth(token),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_admin_analytics_users(client, admin_user):
    """Admin can retrieve user analytics."""
    token = create_access_token(user_id=admin_user.id, role="admin")
    resp = await client.get(
        "/api/v1/admin/analytics/users",
        headers=_auth(token),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_admin_system_health(client, admin_user):
    """Admin can check system health."""
    token = create_access_token(user_id=admin_user.id, role="admin")
    resp = await client.get(
        "/api/v1/admin/analytics/system",
        headers=_auth(token),
    )
    assert resp.status_code == 200
