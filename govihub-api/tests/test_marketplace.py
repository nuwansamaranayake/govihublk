"""GoviHub Marketplace Tests — Supply listing CRUD and search."""

from __future__ import annotations

import uuid

import pytest

from app.auth.service import create_access_token
from app.marketplace.models import SupplyCategory, SupplyStatus


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Supply listing creation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_supply_listing(client, supplier_user):
    """Supplier can create a supply listing."""
    token = create_access_token(user_id=supplier_user.id, role="supplier")
    payload = {
        "name": "Organic Fertilizer NPK 15-15-15",
        "name_si": "කාබනික පොහොර",
        "category": "fertilizer",
        "price": 850.0,
        "unit": "kg",
        "stock_quantity": 500,
        "delivery_available": True,
        "delivery_radius_km": 100,
    }
    resp = await client.post(
        "/api/v1/marketplace/listings",
        json=payload,
        headers=_auth(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["supplier_id"] == str(supplier_user.id)
    assert data["name"] == "Organic Fertilizer NPK 15-15-15"
    assert data["category"] == "fertilizer"


@pytest.mark.asyncio
async def test_farmer_cannot_create_supply_listing(client, farmer_user):
    """Farmer role is not allowed to create supply listings."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    payload = {
        "name": "Some seeds",
        "category": "seeds",
        "price": 100.0,
        "unit": "packet",
    }
    resp = await client.post(
        "/api/v1/marketplace/listings",
        json=payload,
        headers=_auth(token),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_buyer_cannot_create_supply_listing(client, buyer_user):
    """Buyer role is not allowed to create supply listings."""
    token = create_access_token(user_id=buyer_user.id, role="buyer")
    payload = {"name": "Seeds", "category": "seeds"}
    resp = await client.post(
        "/api/v1/marketplace/listings",
        json=payload,
        headers=_auth(token),
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Supply listing retrieval and search
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_supply_listings_public(client, supply_listing):
    """Supply listings are publicly accessible (no auth required) or with auth."""
    # Try without auth first
    resp = await client.get("/api/v1/marketplace/listings")
    assert resp.status_code in (200, 401)


@pytest.mark.asyncio
async def test_list_supply_listings_authenticated(client, farmer_user, supply_listing):
    """Authenticated user can browse supply listings."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.get(
        "/api/v1/marketplace/listings",
        headers=_auth(token),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_search_supply_listings_by_category(client, farmer_user, supply_listing):
    """Supply listings can be filtered by category."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.get(
        "/api/v1/marketplace/listings?category=seeds",
        headers=_auth(token),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_supply_listing_by_id(client, farmer_user, supply_listing):
    """Individual supply listing can be retrieved by ID."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.get(
        f"/api/v1/marketplace/listings/{supply_listing.id}",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(supply_listing.id)


@pytest.mark.asyncio
async def test_update_own_supply_listing(client, supplier_user, supply_listing):
    """Supplier can update their own supply listing."""
    token = create_access_token(user_id=supplier_user.id, role="supplier")
    resp = await client.patch(
        f"/api/v1/marketplace/listings/{supply_listing.id}",
        json={"price": 950.0, "stock_quantity": 450},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert float(data["price"]) == 950.0


@pytest.mark.asyncio
async def test_delete_own_supply_listing(client, supplier_user, supply_listing):
    """Supplier can delete their own supply listing."""
    token = create_access_token(user_id=supplier_user.id, role="supplier")
    resp = await client.delete(
        f"/api/v1/marketplace/listings/{supply_listing.id}",
        headers=_auth(token),
    )
    assert resp.status_code in (200, 204)


# ---------------------------------------------------------------------------
# Supply category enum tests
# ---------------------------------------------------------------------------

def test_supply_categories_include_expected_values():
    """SupplyCategory enum contains core agricultural supply categories."""
    cats = {c.value for c in SupplyCategory}
    assert "seeds" in cats
    assert "fertilizer" in cats
    assert "pesticide" in cats
    assert "equipment" in cats


def test_supply_status_enum_values():
    """SupplyStatus has expected states."""
    statuses = {s.value for s in SupplyStatus}
    assert "active" in statuses
    assert "out_of_stock" in statuses
    assert "discontinued" in statuses
