"""GoviHub Matching Service — Match lifecycle management.

Simplified status lifecycle:
  proposed → accepted → completed
                     ↘ dismissed
  proposed → dismissed
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

import structlog
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.listings.models import DemandPosting, DemandStatus, HarvestListing, HarvestStatus
from app.matching.models import Match, MatchStatus
from app.users.models import User, UserRole

logger = structlog.get_logger()


class MatchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    async def list_matches(
        self,
        current_user: User,
        *,
        status: Optional[str] = None,
        harvest_id: Optional[UUID] = None,
        demand_id: Optional[UUID] = None,
        min_score: Optional[float] = None,
        page: int = 1,
        size: int = 20,
    ) -> List[Match]:
        """Return matches visible to the current user (scoped by role)."""
        query = select(Match)

        # Role-based scoping: farmers see their harvests; buyers see their demands
        if current_user.role == UserRole.farmer:
            from app.listings.models import HarvestListing
            farmer_harvests = select(HarvestListing.id).where(
                HarvestListing.farmer_id == current_user.id
            )
            query = query.where(Match.harvest_id.in_(farmer_harvests))
        elif current_user.role == UserRole.buyer:
            from app.listings.models import DemandPosting
            buyer_demands = select(DemandPosting.id).where(
                DemandPosting.buyer_id == current_user.id
            )
            query = query.where(Match.demand_id.in_(buyer_demands))
        # admin sees all

        if status:
            query = query.where(Match.status == status)
        if harvest_id:
            query = query.where(Match.harvest_id == harvest_id)
        if demand_id:
            query = query.where(Match.demand_id == demand_id)
        if min_score is not None:
            query = query.where(Match.score >= min_score)

        query = query.order_by(Match.score.desc()).offset((page - 1) * size).limit(size)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_match(self, match_id: UUID, current_user: User) -> Match:
        """Fetch a single match, enforcing ownership."""
        match = await self.db.get(Match, match_id)
        if match is None:
            raise NotFoundError(detail="Match not found")

        await self._assert_can_view(match, current_user)
        return match

    # ------------------------------------------------------------------
    # State transitions (simplified: accept / complete / dismiss)
    # ------------------------------------------------------------------

    async def accept_match(
        self,
        match_id: UUID,
        current_user: User,
        *,
        agreed_price_per_kg: Optional[float] = None,
        agreed_quantity_kg: Optional[float] = None,
        notes: Optional[str] = None,
    ) -> Match:
        """Accept a proposed match → status becomes 'accepted'.

        Either farmer or buyer can accept. Once accepted, contact info
        is visible and both parties can coordinate directly.
        """
        match = await self._get_and_assert_participant(match_id, current_user)

        if match.status != MatchStatus.proposed:
            raise ValidationError(
                detail=f"Cannot accept a match with status '{match.status.value}'"
            )

        # Apply negotiation fields if provided
        if agreed_price_per_kg is not None:
            match.agreed_price_per_kg = agreed_price_per_kg
        if agreed_quantity_kg is not None:
            match.agreed_quantity_kg = agreed_quantity_kg
        if notes is not None:
            match.notes = notes

        match.status = MatchStatus.accepted
        match.confirmed_at = datetime.now(timezone.utc)

        # Cascade to listing statuses
        await self._cascade_accepted(match)

        await self.db.flush()
        logger.info(
            "match_accepted",
            match_id=str(match_id),
            new_status="accepted",
            user_id=str(current_user.id),
        )
        return match

    async def complete_match(
        self,
        match_id: UUID,
        current_user: User,
        *,
        notes: Optional[str] = None,
    ) -> Match:
        """Mark an accepted match as completed (goods delivered / payment done)."""
        match = await self._get_and_assert_participant(match_id, current_user)

        if match.status != MatchStatus.accepted:
            raise ValidationError(
                detail=f"Cannot complete a match with status '{match.status.value}'"
            )

        match.status = MatchStatus.completed
        match.fulfilled_at = datetime.now(timezone.utc)
        if notes:
            match.notes = notes

        await self._cascade_completed(match)

        await self.db.flush()
        logger.info("match_completed", match_id=str(match_id), user_id=str(current_user.id))
        return match

    async def dismiss_match(
        self,
        match_id: UUID,
        current_user: User,
        *,
        notes: Optional[str] = None,
    ) -> Match:
        """Dismiss a match (reject / cancel). Works from proposed or accepted."""
        match = await self._get_and_assert_participant(match_id, current_user)

        terminal = {MatchStatus.completed, MatchStatus.dismissed}
        if match.status in terminal:
            raise ValidationError(
                detail=f"Cannot dismiss a match with status '{match.status.value}'"
            )

        match.status = MatchStatus.dismissed
        if notes:
            match.notes = notes

        # Revert listing statuses if no remaining active matches
        await self._cascade_dismissed(match)

        await self.db.flush()
        logger.info("match_dismissed", match_id=str(match_id), user_id=str(current_user.id))
        return match

    # ------------------------------------------------------------------
    # Legacy aliases — keep old endpoints working during transition
    # ------------------------------------------------------------------

    async def reject_match(self, match_id: UUID, current_user: User, *, notes: Optional[str] = None) -> Match:
        return await self.dismiss_match(match_id, current_user, notes=notes)

    async def confirm_match(self, match_id: UUID, current_user: User, *, agreed_price_per_kg: float = None, agreed_quantity_kg: float = None, notes: Optional[str] = None) -> Match:
        return await self.accept_match(match_id, current_user, agreed_price_per_kg=agreed_price_per_kg, agreed_quantity_kg=agreed_quantity_kg, notes=notes)

    async def fulfill_match(self, match_id: UUID, current_user: User, *, notes: Optional[str] = None) -> Match:
        return await self.complete_match(match_id, current_user, notes=notes)

    async def dispute_match(self, match_id: UUID, current_user: User, *, notes: str = None) -> Match:
        return await self.dismiss_match(match_id, current_user, notes=notes)

    # ------------------------------------------------------------------
    # Cascade helpers — keep listing statuses in sync
    # ------------------------------------------------------------------

    async def _cascade_proposed(self, match: Match) -> None:
        """When a match is proposed: move demand to 'reviewing' if still 'open'."""
        demand = await self.db.get(DemandPosting, match.demand_id)
        if demand and demand.status == DemandStatus.open:
            demand.status = DemandStatus.reviewing
            logger.info(
                "demand_status_cascade",
                demand_id=str(match.demand_id),
                new_status="reviewing",
                reason="match_proposed",
            )

    async def _cascade_accepted(self, match: Match) -> None:
        """When a match is accepted: harvest→'matched', demand→'confirmed'."""
        harvest = await self.db.get(HarvestListing, match.harvest_id)
        if harvest and harvest.status in (HarvestStatus.ready, HarvestStatus.planned):
            harvest.status = HarvestStatus.matched
            logger.info(
                "harvest_status_cascade",
                harvest_id=str(match.harvest_id),
                new_status="matched",
                reason="match_accepted",
            )

        demand = await self.db.get(DemandPosting, match.demand_id)
        if demand and demand.status in (DemandStatus.open, DemandStatus.reviewing):
            demand.status = DemandStatus.confirmed
            logger.info(
                "demand_status_cascade",
                demand_id=str(match.demand_id),
                new_status="confirmed",
                reason="match_accepted",
            )

    async def _cascade_completed(self, match: Match) -> None:
        """When a match is completed: harvest→'fulfilled', demand→'fulfilled' if all done."""
        harvest = await self.db.get(HarvestListing, match.harvest_id)
        if harvest and harvest.status == HarvestStatus.matched:
            harvest.status = HarvestStatus.fulfilled
            logger.info(
                "harvest_status_cascade",
                harvest_id=str(match.harvest_id),
                new_status="fulfilled",
                reason="match_completed",
            )

        # Only move demand to fulfilled if all its non-dismissed matches are completed
        remaining = await self.db.execute(
            select(Match).where(
                and_(
                    Match.demand_id == match.demand_id,
                    Match.id != match.id,
                    Match.status.not_in([MatchStatus.dismissed, MatchStatus.completed]),
                )
            )
        )
        if remaining.scalar_one_or_none() is None:
            demand = await self.db.get(DemandPosting, match.demand_id)
            if demand and demand.status == DemandStatus.confirmed:
                demand.status = DemandStatus.fulfilled
                logger.info(
                    "demand_status_cascade",
                    demand_id=str(match.demand_id),
                    new_status="fulfilled",
                    reason="all_matches_completed",
                )

    async def _cascade_dismissed(self, match: Match) -> None:
        """When a match is dismissed: revert harvest/demand if no remaining active matches."""
        active_statuses = [MatchStatus.proposed, MatchStatus.accepted]

        # Check for other active matches on this harvest
        harvest_active = await self.db.execute(
            select(Match).where(
                and_(
                    Match.harvest_id == match.harvest_id,
                    Match.id != match.id,
                    Match.status.in_(active_statuses),
                )
            )
        )
        if harvest_active.scalar_one_or_none() is None:
            harvest = await self.db.get(HarvestListing, match.harvest_id)
            if harvest and harvest.status == HarvestStatus.matched:
                harvest.status = HarvestStatus.ready
                logger.info(
                    "harvest_status_cascade",
                    harvest_id=str(match.harvest_id),
                    new_status="ready",
                    reason="match_dismissed_no_remaining",
                )

        # Check for other active matches on this demand
        demand_active = await self.db.execute(
            select(Match).where(
                and_(
                    Match.demand_id == match.demand_id,
                    Match.id != match.id,
                    Match.status.in_(active_statuses),
                )
            )
        )
        if demand_active.scalar_one_or_none() is None:
            demand = await self.db.get(DemandPosting, match.demand_id)
            if demand and demand.status in (DemandStatus.reviewing, DemandStatus.confirmed):
                demand.status = DemandStatus.open
                logger.info(
                    "demand_status_cascade",
                    demand_id=str(match.demand_id),
                    new_status="open",
                    reason="match_dismissed_no_remaining",
                )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _get_and_assert_participant(self, match_id: UUID, user: User) -> Match:
        """Load match and verify that the user is a participant (or admin)."""
        match = await self.db.get(Match, match_id)
        if match is None:
            raise NotFoundError(detail="Match not found")
        await self._assert_can_act(match, user)
        return match

    async def _assert_can_view(self, match: Match, user: User) -> None:
        """Raise ForbiddenError if user cannot view this match."""
        if user.role == UserRole.admin:
            return

        if user.role == UserRole.farmer:
            from app.listings.models import HarvestListing
            harvest = await self.db.get(HarvestListing, match.harvest_id)
            if harvest and harvest.farmer_id == user.id:
                return
        elif user.role == UserRole.buyer:
            from app.listings.models import DemandPosting
            demand = await self.db.get(DemandPosting, match.demand_id)
            if demand and demand.buyer_id == user.id:
                return

        raise ForbiddenError(detail="You do not have access to this match")

    async def _assert_can_act(self, match: Match, user: User) -> None:
        """Raise ForbiddenError if user cannot act on this match."""
        if user.role == UserRole.admin:
            return

        if user.role == UserRole.farmer:
            from app.listings.models import HarvestListing
            harvest = await self.db.get(HarvestListing, match.harvest_id)
            if harvest and harvest.farmer_id == user.id:
                return
        elif user.role == UserRole.buyer:
            from app.listings.models import DemandPosting
            demand = await self.db.get(DemandPosting, match.demand_id)
            if demand and demand.buyer_id == user.id:
                return

        raise ForbiddenError(detail="You are not a participant in this match")
