"""Tests for self-service role change — PUT /users/me/role + eligibility GET.

See ROLE_CHANGE_AUDIT.md. Real match enum = {proposed, accepted, completed, dismissed};
active-to-block = {proposed, accepted}. require_complete_profile needs a phone for non-admins.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.auth.service import create_access_token, decode_access_token


def _auth(user) -> dict:
    token = create_access_token(user_id=user.id, role=user.role.value)
    return {"Authorization": f"Bearer {token}"}


async def _with_phone(db_session, user, phone="+94771234567"):
    user.phone = phone
    await db_session.flush()


@pytest.mark.asyncio
async def test_change_role_same_role_400(client, db_session, buyer_user):
    await _with_phone(db_session, buyer_user)
    res = await client.put("/api/v1/users/me/role", json={"new_role": "buyer"}, headers=_auth(buyer_user))
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "ROLE_SAME"


@pytest.mark.asyncio
async def test_change_role_admin_forbidden_400(client, admin_user):
    token = create_access_token(user_id=admin_user.id, role="admin")
    res = await client.put(
        "/api/v1/users/me/role", json={"new_role": "farmer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "ROLE_INVALID"


@pytest.mark.asyncio
async def test_change_role_cooldown_429(client, db_session, buyer_user):
    await _with_phone(db_session, buyer_user)
    buyer_user.last_role_change_at = datetime.now(timezone.utc) - timedelta(days=5)
    await db_session.flush()
    res = await client.put("/api/v1/users/me/role", json={"new_role": "farmer"}, headers=_auth(buyer_user))
    assert res.status_code == 429
    err = res.json()["error"]
    assert err["code"] == "ROLE_CHANGE_COOLDOWN"
    assert err["details"]["retry_after_days"] >= 1
    assert "next_allowed_at" in err["details"]


@pytest.mark.asyncio
async def test_change_role_active_match_409(client, db_session, buyer_user, match_record):
    # match_record links harvest(farmer) + demand(buyer_user), status=proposed
    await _with_phone(db_session, buyer_user)
    res = await client.put("/api/v1/users/me/role", json={"new_role": "farmer"}, headers=_auth(buyer_user))
    assert res.status_code == 409
    err = res.json()["error"]
    assert err["code"] == "ACTIVE_MATCHES_EXIST"
    assert err["details"]["count"] == 1


@pytest.mark.asyncio
async def test_change_role_success_keeps_old_profile_and_returns_tokens(client, db_session, buyer_user):
    from app.users.models import BuyerProfile, FarmerProfile

    await _with_phone(db_session, buyer_user)
    res = await client.put("/api/v1/users/me/role", json={"new_role": "farmer"}, headers=_auth(buyer_user))
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["ok"] is True
    assert data["role"] == "farmer"
    assert data["access_token"] and data["refresh_token"]
    # fresh access token carries the NEW role claim
    assert decode_access_token(data["access_token"]).role == "farmer"
    # old buyer profile KEPT (Decision 4); new farmer profile created
    assert await db_session.scalar(select(BuyerProfile).where(BuyerProfile.user_id == buyer_user.id)) is not None
    assert await db_session.scalar(select(FarmerProfile).where(FarmerProfile.user_id == buyer_user.id)) is not None
    await db_session.refresh(buyer_user)
    assert buyer_user.role.value == "farmer"
    assert buyer_user.last_role_change_at is not None


@pytest.mark.asyncio
async def test_change_role_deactivates_listings_and_counts(client, db_session, buyer_user, demand_posting):
    await _with_phone(db_session, buyer_user)
    res = await client.put("/api/v1/users/me/role", json={"new_role": "supplier"}, headers=_auth(buyer_user))
    assert res.status_code == 200, res.text
    assert res.json()["listings_deactivated"] == 1
    await db_session.refresh(demand_posting)
    assert getattr(demand_posting.status, "value", demand_posting.status) == "cancelled"


@pytest.mark.asyncio
async def test_change_role_writes_audit_row(client, db_session, buyer_user):
    from app.users.models import RoleChange

    await _with_phone(db_session, buyer_user)
    res = await client.put("/api/v1/users/me/role", json={"new_role": "farmer"}, headers=_auth(buyer_user))
    assert res.status_code == 200, res.text
    row = await db_session.scalar(select(RoleChange).where(RoleChange.user_id == buyer_user.id))
    assert row is not None
    assert row.old_role == "buyer" and row.new_role == "farmer"


@pytest.mark.asyncio
async def test_eligibility_reports_cooldown(client, db_session, buyer_user):
    await _with_phone(db_session, buyer_user)
    buyer_user.last_role_change_at = datetime.now(timezone.utc) - timedelta(days=10)
    await db_session.flush()
    res = await client.get("/api/v1/users/me/role-change-eligibility", headers=_auth(buyer_user))
    assert res.status_code == 200
    data = res.json()
    assert data["eligible"] is False
    assert data["reason"] == "cooldown"
    assert data["cooldown_ends_at"] is not None


@pytest.mark.asyncio
async def test_eligibility_ok_when_clean(client, db_session, supplier_user):
    await _with_phone(db_session, supplier_user)
    res = await client.get("/api/v1/users/me/role-change-eligibility", headers=_auth(supplier_user))
    assert res.status_code == 200
    assert res.json()["eligible"] is True
