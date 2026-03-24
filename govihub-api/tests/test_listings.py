"""GoviHub Listings Tests — Harvest CRUD, demand CRUD, status transitions, ownership."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest

from app.auth.service import create_access_token
from app.listings.models import DemandStatus, HarvestListing, ListingStatus


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Harvest listing creation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_harvest_listing(client, farmer_user, crop_taxonomy):
    """Farmer can create a harvest listing."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    payload = {
        "crop_id": str(crop_taxonomy.id),
        "quantity_kg": 200.0,
        "price_per_kg": 95.0,
        "quality_grade": "B",
        "harvest_date": str(date.today()),
        "available_from": str(date.today()),
        "available_until": str(date.today() + timedelta(days=21)),
        "is_organic": False,
        "delivery_available": True,
        "delivery_radius_km": 40,
    }
    resp = await client.post(
        "/api/v1/listings/harvest",
        json=payload,
        headers=_auth(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["crop_id"] == str(crop_taxonomy.id)
    assert float(data["quantity_kg"]) == 200.0
    assert data["farmer_id"] == str(farmer_user.id)


@pytest.mark.asyncio
async def test_buyer_cannot_create_harvest_listing(client, buyer_user, crop_taxonomy):
    """Buyer role is forbidden from creating harvest listings."""
    token = create_access_token(user_id=buyer_user.id, role="buyer")
    payload = {
        "crop_id": str(crop_taxonomy.id),
        "quantity_kg": 100.0,
    }
    resp = await client.post(
        "/api/v1/listings/harvest",
        json=payload,
        headers=_auth(token),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_harvest_listings(client, farmer_user, harvest_listing):
    """Authenticated user can list active harvest listings."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.get("/api/v1/listings/harvest", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data or isinstance(data, list)


@pytest.mark.asyncio
async def test_get_harvest_listing_by_id(client, farmer_user, harvest_listing):
    """Can retrieve a specific harvest listing by ID."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.get(
        f"/api/v1/listings/harvest/{harvest_listing.id}",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(harvest_listing.id)


# ---------------------------------------------------------------------------
# Harvest listing updates
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_own_harvest_listing(client, farmer_user, harvest_listing):
    """Farmer can update their own listing."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.patch(
        f"/api/v1/listings/harvest/{harvest_listing.id}",
        json={"price_per_kg": 130.0, "description": "Fresh from farm"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert float(resp.json()["price_per_kg"]) == 130.0


@pytest.mark.asyncio
async def test_other_farmer_cannot_update_listing(client, db_session, harvest_listing, crop_taxonomy):
    """Another farmer cannot update a listing they do not own."""
    from app.users.models import User, UserRole

    other_farmer = User(
        id=uuid.uuid4(),
        email="other_farmer@test.lk",
        name="Other Farmer",
        role=UserRole.farmer,
        is_active=True,
        is_verified=True,
    )
    db_session.add(other_farmer)
    await db_session.flush()

    token = create_access_token(user_id=other_farmer.id, role="farmer")
    resp = await client.patch(
        f"/api/v1/listings/harvest/{harvest_listing.id}",
        json={"price_per_kg": 999.0},
        headers=_auth(token),
    )
    assert resp.status_code in (403, 404)


# ---------------------------------------------------------------------------
# Demand posting CRUD
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_demand_posting(client, buyer_user, crop_taxonomy):
    """Buyer can create a demand posting."""
    token = create_access_token(user_id=buyer_user.id, role="buyer")
    payload = {
        "crop_id": str(crop_taxonomy.id),
        "quantity_kg": 500.0,
        "max_price_per_kg": 110.0,
        "needed_by": str(date.today() + timedelta(days=7)),
        "radius_km": 75,
    }
    resp = await client.post(
        "/api/v1/listings/demand",
        json=payload,
        headers=_auth(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["buyer_id"] == str(buyer_user.id)
    assert float(data["quantity_kg"]) == 500.0


@pytest.mark.asyncio
async def test_farmer_cannot_create_demand(client, farmer_user, crop_taxonomy):
    """Farmer role is forbidden from creating demand postings."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    payload = {
        "crop_id": str(crop_taxonomy.id),
        "quantity_kg": 100.0,
    }
    resp = await client.post(
        "/api/v1/listings/demand",
        json=payload,
        headers=_auth(token),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_own_demand_posting(client, buyer_user, demand_posting):
    """Buyer can delete (cancel) their own demand posting."""
    token = create_access_token(user_id=buyer_user.id, role="buyer")
    resp = await client.delete(
        f"/api/v1/listings/demand/{demand_posting.id}",
        headers=_auth(token),
    )
    assert resp.status_code in (200, 204)


# ---------------------------------------------------------------------------
# Status transitions
# ---------------------------------------------------------------------------

def test_listing_status_enum_values():
    """ListingStatus contains expected transitions."""
    statuses = {s.value for s in ListingStatus}
    assert "draft" in statuses
    assert "active" in statuses
    assert "matched" in statuses
    assert "sold" in statuses
    assert "expired" in statuses
    assert "cancelled" in statuses


def test_demand_status_enum_values():
    """DemandStatus has fulfilled instead of sold."""
    statuses = {s.value for s in DemandStatus}
    assert "fulfilled" in statuses
    assert "sold" not in statuses
