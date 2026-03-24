"""GoviHub Matching Router — REST endpoints for match lifecycle."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_active_user, get_db
from app.matching.schemas import (
    MatchAcceptRequest,
    MatchBrief,
    MatchConfirmRequest,
    MatchDisputeRequest,
    MatchFulfillRequest,
    MatchRead,
    MatchRejectRequest,
)
from app.matching.service import MatchService
from app.users.models import User

router = APIRouter()


@router.get("", response_model=list[MatchBrief], summary="List my matches")
async def list_matches(
    status: str = Query(None, description="Filter by match status"),
    harvest_id: UUID = Query(None),
    demand_id: UUID = Query(None),
    min_score: float = Query(None, ge=0.0, le=1.0),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
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
    return matches


@router.get("/{match_id}", response_model=MatchRead, summary="Get match detail")
async def get_match(
    match_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve full details of a single match."""
    svc = MatchService(db)
    match = await svc.get_match(match_id, current_user)
    return match


@router.post("/{match_id}/accept", response_model=MatchRead, summary="Accept a match")
async def accept_match(
    match_id: UUID,
    body: MatchAcceptRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept a proposed match.

    - Farmer accepting → status becomes `accepted_farmer`
    - Buyer accepting → status becomes `accepted_buyer`
    - Second party accepting → status becomes `confirmed`
    """
    svc = MatchService(db)
    match = await svc.accept_match(
        match_id,
        current_user,
        agreed_price_per_kg=body.agreed_price_per_kg,
        agreed_quantity_kg=body.agreed_quantity_kg,
        notes=body.notes,
    )
    await db.commit()
    return match


@router.post("/{match_id}/reject", response_model=MatchRead, summary="Reject / cancel a match")
async def reject_match(
    match_id: UUID,
    body: MatchRejectRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a match that has not yet been fulfilled."""
    svc = MatchService(db)
    match = await svc.reject_match(match_id, current_user, notes=body.notes)
    await db.commit()
    return match


@router.post("/{match_id}/confirm", response_model=MatchRead, summary="Confirm a match")
async def confirm_match(
    match_id: UUID,
    body: MatchConfirmRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Explicitly confirm a match with agreed price and quantity."""
    svc = MatchService(db)
    match = await svc.confirm_match(
        match_id,
        current_user,
        agreed_price_per_kg=body.agreed_price_per_kg,
        agreed_quantity_kg=body.agreed_quantity_kg,
        notes=body.notes,
    )
    await db.commit()
    return match


@router.patch("/{match_id}/fulfill", response_model=MatchRead, summary="Mark match as fulfilled")
async def fulfill_match(
    match_id: UUID,
    body: MatchFulfillRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Record that the transaction has been completed (goods delivered, payment done)."""
    svc = MatchService(db)
    match = await svc.fulfill_match(match_id, current_user, notes=body.notes)
    await db.commit()
    return match


@router.patch("/{match_id}/dispute", response_model=MatchRead, summary="Raise a dispute")
async def dispute_match(
    match_id: UUID,
    body: MatchDisputeRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Raise a dispute on a confirmed or in-transit match."""
    svc = MatchService(db)
    match = await svc.dispute_match(match_id, current_user, notes=body.notes)
    await db.commit()
    return match
