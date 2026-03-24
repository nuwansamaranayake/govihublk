"""GoviHub Matching Tests — Scoring with known inputs, hard filters, match lifecycle."""

from __future__ import annotations

import math
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

from app.auth.service import create_access_token
from app.matching.engine import MatchingEngine, WEIGHTS, MAX_DISTANCE_KM, SCORE_THRESHOLD


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Scoring unit tests (no database required)
# ---------------------------------------------------------------------------

def test_score_perfect_match():
    """Same location, matching quantity, near deadline, fresh listing gives high score."""
    score, breakdown = MatchingEngine.compute_match_score(
        harvest_qty=300.0,
        demand_qty=300.0,
        harvest_avail_from=date.today(),
        harvest_avail_until=date.today() + timedelta(days=30),
        demand_needed_by=date.today() + timedelta(days=15),
        harvest_created=datetime.now(timezone.utc),
        distance_km=0.0,
    )
    assert score > 0.75
    assert breakdown["quantity_score"] == 1.0
    assert breakdown["distance_score"] == 1.0
    assert breakdown["freshness_score"] == pytest.approx(1.0, abs=0.01)


def test_score_zero_distance():
    """Distance of 0 km gives maximum distance score of 1.0."""
    _, breakdown = MatchingEngine.compute_match_score(
        harvest_qty=100.0,
        demand_qty=100.0,
        harvest_avail_from=None,
        harvest_avail_until=None,
        demand_needed_by=None,
        harvest_created=datetime.now(timezone.utc),
        distance_km=0.0,
    )
    assert breakdown["distance_score"] == 1.0


def test_score_max_distance_exclusion():
    """Distance at or beyond MAX_DISTANCE_KM gives distance score of 0."""
    _, breakdown = MatchingEngine.compute_match_score(
        harvest_qty=100.0,
        demand_qty=100.0,
        harvest_avail_from=None,
        harvest_avail_until=None,
        demand_needed_by=None,
        harvest_created=datetime.now(timezone.utc),
        distance_km=MAX_DISTANCE_KM,
    )
    assert breakdown["distance_score"] == 0.0


def test_score_no_geo_data_neutral():
    """When distance is None, distance score is neutral (0.5)."""
    _, breakdown = MatchingEngine.compute_match_score(
        harvest_qty=100.0,
        demand_qty=100.0,
        harvest_avail_from=None,
        harvest_avail_until=None,
        demand_needed_by=None,
        harvest_created=datetime.now(timezone.utc),
        distance_km=None,
    )
    assert breakdown["distance_score"] == 0.5


def test_score_quantity_mismatch_penalty():
    """Large quantity mismatch reduces quantity score proportionally."""
    _, breakdown_good = MatchingEngine.compute_match_score(
        harvest_qty=100.0,
        demand_qty=100.0,
        harvest_avail_from=None,
        harvest_avail_until=None,
        demand_needed_by=None,
        harvest_created=datetime.now(timezone.utc),
        distance_km=None,
    )
    _, breakdown_bad = MatchingEngine.compute_match_score(
        harvest_qty=10.0,
        demand_qty=1000.0,
        harvest_avail_from=None,
        harvest_avail_until=None,
        demand_needed_by=None,
        harvest_created=datetime.now(timezone.utc),
        distance_km=None,
    )
    assert breakdown_good["quantity_score"] > breakdown_bad["quantity_score"]
    assert breakdown_bad["quantity_score"] == pytest.approx(0.01, abs=0.001)


def test_score_freshness_decays_over_time():
    """Older listings have lower freshness scores (exponential decay)."""
    old_created = datetime.now(timezone.utc) - timedelta(days=60)
    new_created = datetime.now(timezone.utc)

    _, breakdown_old = MatchingEngine.compute_match_score(
        harvest_qty=100.0,
        demand_qty=100.0,
        harvest_avail_from=None,
        harvest_avail_until=None,
        demand_needed_by=None,
        harvest_created=old_created,
        distance_km=None,
    )
    _, breakdown_new = MatchingEngine.compute_match_score(
        harvest_qty=100.0,
        demand_qty=100.0,
        harvest_avail_from=None,
        harvest_avail_until=None,
        demand_needed_by=None,
        harvest_created=new_created,
        distance_km=None,
    )
    assert breakdown_new["freshness_score"] > breakdown_old["freshness_score"]


def test_score_expired_date_overlap_zero():
    """Past needed_by date gives date overlap score of 0."""
    _, breakdown = MatchingEngine.compute_match_score(
        harvest_qty=100.0,
        demand_qty=100.0,
        harvest_avail_from=date.today() - timedelta(days=60),
        harvest_avail_until=date.today() - timedelta(days=30),  # expired
        demand_needed_by=date.today() - timedelta(days=40),
        harvest_created=datetime.now(timezone.utc),
        distance_km=0.0,
    )
    assert breakdown["date_overlap_score"] == 0.0


def test_score_weights_sum_to_one():
    """WEIGHTS dictionary values must sum to 1.0."""
    total = sum(WEIGHTS.values())
    assert total == pytest.approx(1.0, abs=1e-6)


def test_score_within_bounds():
    """Score is always between 0 and 1 inclusive."""
    for qty_h, qty_d, dist in [(1, 1000, 0), (100, 100, 300), (50, 50, 150)]:
        score, _ = MatchingEngine.compute_match_score(
            harvest_qty=float(qty_h),
            demand_qty=float(qty_d),
            harvest_avail_from=None,
            harvest_avail_until=None,
            demand_needed_by=None,
            harvest_created=datetime.now(timezone.utc),
            distance_km=float(dist),
        )
        assert 0.0 <= score <= 1.0


# ---------------------------------------------------------------------------
# Match lifecycle via API
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_matches_farmer(client, farmer_user, match_record):
    """Farmer can list matches for their harvest listings."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.get("/api/v1/matches", headers=_auth(token))
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_match_detail(client, farmer_user, match_record):
    """Farmer can retrieve specific match details."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.get(
        f"/api/v1/matches/{match_record.id}",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(match_record.id)
    assert "score" in data


@pytest.mark.asyncio
async def test_match_unauthenticated_returns_401(client):
    """Unauthenticated request to matches endpoint returns 401."""
    resp = await client.get("/api/v1/matches")
    assert resp.status_code == 401
