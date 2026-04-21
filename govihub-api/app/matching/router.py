"""GoviHub Matching Router — REST endpoints for match lifecycle.

Simplified status lifecycle: proposed → accepted → completed | dismissed
"""

from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_complete_profile
from app.listings.models import DemandPosting, HarvestListing
from app.matching.models import Match
from app.matching.schemas import (
    MatchAcceptRequest,
    MatchCompleteRequest,
    MatchDismissRequest,
    MatchPartyInfo,
    MatchRead,
)
from app.matching.service import MatchService
from app.users.models import User

logger = structlog.get_logger()

router = APIRouter()


async def _enrich_match(db: AsyncSession, match: Match) -> dict:
    """Add farmer/buyer contact info and crop details to a match dict."""
    data = {
        "id": match.id,
        "harvest_id": match.harvest_id,
        "demand_id": match.demand_id,
        "score": match.score,
        "score_breakdown": match.score_breakdown,
        "status": match.status.value if hasattr(match.status, "value") else match.status,
        "agreed_price_per_kg": float(match.agreed_price_per_kg) if match.agreed_price_per_kg else None,
        "agreed_quantity_kg": float(match.agreed_quantity_kg) if match.agreed_quantity_kg else None,
        "notes": match.notes,
        "confirmed_at": match.confirmed_at,
        "fulfilled_at": match.fulfilled_at,
        "created_at": match.created_at,
        "updated_at": match.updated_at,
    }

    # Load harvest → farmer + crop + listing details
    harvest = await db.get(HarvestListing, match.harvest_id)
    if harvest:
        data["harvest_quantity_kg"] = float(harvest.quantity_kg) if harvest.quantity_kg else None
        data["harvest"] = {
            "id": str(harvest.id),
            "quantity_kg": float(harvest.quantity_kg) if harvest.quantity_kg else None,
            "price_per_kg": float(harvest.price_per_kg) if harvest.price_per_kg else None,
            "min_price_per_kg": float(harvest.min_price_per_kg) if harvest.min_price_per_kg else None,
            "variety": harvest.variety,
            "grade": harvest.quality_grade,
            "harvest_date": str(harvest.harvest_date) if harvest.harvest_date else None,
            "available_from": str(harvest.available_from) if harvest.available_from else None,
            "available_until": str(harvest.available_until) if harvest.available_until else None,
            "description": harvest.description,
            "images": harvest.images,
            "status": harvest.status.value if hasattr(harvest.status, "value") else harvest.status,
            "is_organic": harvest.is_organic,
            "delivery_available": harvest.delivery_available,
            "created_at": str(harvest.created_at) if harvest.created_at else None,
        }
        farmer = await db.get(User, harvest.farmer_id)
        if farmer:
            data["farmer"] = MatchPartyInfo(
                name=farmer.name,
                phone=farmer.phone,
                district=farmer.district,
            )
        # Crop name
        if harvest.crop_id:
            from app.listings.models import CropTaxonomy
            crop = await db.get(CropTaxonomy, harvest.crop_id)
            if crop:
                data["crop_name"] = crop.name_en

    # Load demand → buyer + listing details
    demand = await db.get(DemandPosting, match.demand_id)
    if demand:
        data["demand_quantity_kg"] = float(demand.quantity_kg) if demand.quantity_kg else None
        data["demand"] = {
            "id": str(demand.id),
            "quantity_kg": float(demand.quantity_kg) if demand.quantity_kg else None,
            "max_price_per_kg": float(demand.max_price_per_kg) if demand.max_price_per_kg else None,
            "variety": demand.variety,
            "grade": demand.quality_grade,
            "needed_by": str(demand.needed_by) if demand.needed_by else None,
            "description": demand.description,
            "status": demand.status.value if hasattr(demand.status, "value") else demand.status,
            "is_recurring": demand.is_recurring,
            "created_at": str(demand.created_at) if demand.created_at else None,
        }
        buyer = await db.get(User, demand.buyer_id)
        if buyer:
            data["buyer"] = MatchPartyInfo(
                name=buyer.name,
                phone=buyer.phone,
                district=buyer.district,
            )

    return data


@router.get("", summary="List my matches")
async def list_matches(
    status: str = Query(None, description="Filter by match status"),
    harvest_id: UUID = Query(None),
    demand_id: UUID = Query(None),
    min_score: float = Query(None, ge=0.0, le=1.0),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Return matches visible to the authenticated user, scoped by role."""
    svc = MatchService(db)
    matches = await svc.list_matches(
        current_user,
        status=status,
        harvest_id=harvest_id,
        demand_id=demand_id,
        min_score=min_score,
        page=page,
        size=size,
    )
    return [await _enrich_match(db, m) for m in matches]


@router.get("/{match_id}", response_model=MatchRead, summary="Get match detail")
async def get_match(
    match_id: UUID,
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve full details of a single match."""
    svc = MatchService(db)
    match = await svc.get_match(match_id, current_user)
    return match


@router.post("/{match_id}/accept", response_model=MatchRead, summary="Accept a match")
async def accept_match(
    match_id: UUID,
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
    body: Optional[MatchAcceptRequest] = None,
):
    """Accept a proposed match → status becomes 'accepted'."""
    svc = MatchService(db)
    match = await svc.accept_match(
        match_id,
        current_user,
        agreed_price_per_kg=body.agreed_price_per_kg if body else None,
        agreed_quantity_kg=body.agreed_quantity_kg if body else None,
        notes=body.notes if body else None,
    )
    await db.commit()
    return match


@router.post("/{match_id}/complete", response_model=MatchRead, summary="Mark match as completed")
async def complete_match(
    match_id: UUID,
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
    body: Optional[MatchCompleteRequest] = None,
):
    """Mark an accepted match as completed (goods delivered, payment done)."""
    svc = MatchService(db)
    match = await svc.complete_match(match_id, current_user, notes=body.notes if body else None)
    await db.commit()
    return match


@router.post("/{match_id}/dismiss", response_model=MatchRead, summary="Dismiss a match")
async def dismiss_match(
    match_id: UUID,
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
    body: Optional[MatchDismissRequest] = None,
):
    """Dismiss (reject/cancel) a match."""
    svc = MatchService(db)
    match = await svc.dismiss_match(match_id, current_user, notes=body.notes if body else None)
    await db.commit()
    return match


# ---------------------------------------------------------------------------
# Legacy aliases — keep old frontend endpoints working during rollout
# ---------------------------------------------------------------------------

@router.post("/{match_id}/reject", response_model=MatchRead, summary="Reject a match (legacy)")
async def reject_match(
    match_id: UUID,
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
    body: Optional[MatchDismissRequest] = None,
):
    """Legacy alias: reject → dismiss."""
    return await dismiss_match(match_id, current_user, db, body)


@router.post("/{match_id}/confirm", response_model=MatchRead, summary="Confirm a match (legacy)")
async def confirm_match(
    match_id: UUID,
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
    body: Optional[MatchAcceptRequest] = None,
):
    """Legacy alias: confirm → accept."""
    return await accept_match(match_id, current_user, db, body)


@router.patch("/{match_id}/fulfill", response_model=MatchRead, summary="Fulfill a match (legacy)")
async def fulfill_match(
    match_id: UUID,
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
    body: Optional[MatchCompleteRequest] = None,
):
    """Legacy alias: fulfill → complete."""
    return await complete_match(match_id, current_user, db, body)
