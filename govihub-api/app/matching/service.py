"""GoviHub Matching Service — Match lifecycle management."""

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
    # State transitions
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
        """Farmer or buyer accepts a proposed match.

        Transition rules:
        - proposed → accepted_farmer  (farmer acts)
        - proposed → accepted_buyer   (buyer acts)
        - accepted_farmer → confirmed  (buyer now accepts)
        - accepted_buyer  → confirmed  (farmer now accepts)
        """
        match = await self._get_and_assert_participant(match_id, current_user)

        role = current_user.role
        allowed_statuses = {MatchStatus.proposed, MatchStatus.accepted_farmer, MatchStatus.accepted_buyer}

        if match.status not in allowed_statuses:
            raise ValidationError(
                detail=f"Cannot accept a match with status '{match.status.value}'"
            )
        if match.status == MatchStatus.confirmed:
            raise ValidationError(detail="Match is already confirmed")

        # Apply negotiation fields if provided
        if agreed_price_per_kg is not None:
            match.agreed_price_per_kg = agreed_price_per_kg
        if agreed_quantity_kg is not None:
            match.agreed_quantity_kg = agreed_quantity_kg
        if notes is not None:
            match.notes = notes

        if role == UserRole.farmer:
            if match.status == MatchStatus.accepted_buyer:
                match.status = MatchStatus.confirmed
                match.confirmed_at = datetime.now(timezone.utc)
            else:
                match.status = MatchStatus.accepted_farmer
        elif role == UserRole.buyer:
            if match.status == MatchStatus.accepted_farmer:
                match.status = MatchStatus.confirmed
                match.confirmed_at = datetime.now(timezone.utc)
            else:
                match.status = MatchStatus.accepted_buyer
        else:
            # Admin can accept on behalf — treat as full confirm
            match.status = MatchStatus.confirmed
            match.confirmed_at = datetime.now(timezone.utc)

        # Cascade to listing statuses when match reaches confirmed
        if match.status == MatchStatus.confirmed:
            await self._cascade_confirmed(match)

        await self.db.flush()
        logger.info(
            "match_accepted",
            match_id=str(match_id),
            new_status=match.status.value,
            user_id=str(current_user.id),
        )
        return match

    async def reject_match(
        self,
        match_id: UUID,
        current_user: User,
        *,
        notes: Optional[str] = None,
    ) -> Match:
        """Cancel a match that has not yet been fulfilled."""
        match = await self._get_and_assert_participant(match_id, current_user)

        terminal = {MatchStatus.fulfilled, MatchStatus.cancelled, MatchStatus.expired}
        if match.status in terminal:
            raise ValidationError(
                detail=f"Cannot reject a match with status '{match.status.value}'"
            )

        match.status = MatchStatus.cancelled
        if notes:
            match.notes = notes

        # Revert listing statuses if no remaining active matches
        await self._cascade_cancelled(match)

        await self.db.flush()
        logger.info("match_rejected", match_id=str(match_id), user_id=str(current_user.id))
        return match

    async def confirm_match(
        self,
        match_id: UUID,
        current_user: User,
        *,
        agreed_price_per_kg: float,
        agreed_quantity_kg: float,
        notes: Optional[str] = None,
    ) -> Match:
        """Force-confirm a match (typically called by admin or after bilateral acceptance).

        From the API perspective this is an explicit confirmation endpoint, useful
        when both parties have already agreed out-of-band.
        """
        match = await self._get_and_assert_participant(match_id, current_user)

        acceptable = {
            MatchStatus.proposed,
            MatchStatus.accepted_farmer,
            MatchStatus.accepted_buyer,
        }
        if match.status not in acceptable:
            raise ValidationError(
                detail=f"Cannot confirm a match with status '{match.status.value}'"
            )

        match.status = MatchStatus.confirmed
        match.agreed_price_per_kg = agreed_price_per_kg
        match.agreed_quantity_kg = agreed_quantity_kg
        match.confirmed_at = datetime.now(timezone.utc)
        if notes:
            match.notes = notes

        await self._cascade_confirmed(match)

        await self.db.flush()
        logger.info("match_confirmed", match_id=str(match_id), user_id=str(current_user.id))
        return match

    async def fulfill_match(
        self,
        match_id: UUID,
        current_user: User,
        *,
        notes: Optional[str] = None,
    ) -> Match:
        """Mark a confirmed match as fulfilled (goods delivered / payment done)."""
        match = await self._get_and_assert_participant(match_id, current_user)

        if match.status not in {MatchStatus.confirmed, MatchStatus.in_transit}:
            raise ValidationError(
                detail=f"Cannot fulfil a match with status '{match.status.value}'"
            )

        match.status = MatchStatus.fulfilled
        match.fulfilled_at = datetime.now(timezone.utc)
        if notes:
            match.notes = notes

        await self._cascade_fulfilled(match)

        await self.db.flush()
        logger.info("match_fulfilled", match_id=str(match_id), user_id=str(current_user.id))
        return match

    async def dispute_match(
        self,
        match_id: UUID,
        current_user: User,
        *,
        notes: str,
    ) -> Match:
        """Raise a dispute on a match in progress."""
        match = await self._get_and_assert_participant(match_id, current_user)

        disputable = {
            MatchStatus.confirmed,
            MatchStatus.in_transit,
            MatchStatus.fulfilled,
        }
        if match.status not in disputable:
            raise ValidationError(
                detail=f"Cannot dispute a match with status '{match.status.value}'"
            )

        match.status = MatchStatus.disputed
        match.notes = notes

        await self.db.flush()
        logger.info("match_disputed", match_id=str(match_id), user_id=str(current_user.id))
        return match

    # ------------------------------------------------------------------
    # Cascade helpers — keep listing statuses in sync with match lifecycle
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

    async def _cascade_confirmed(self, match: Match) -> None:
        """When a match is confirmed: harvest→'matched', demand→'confirmed'."""
        harvest = await self.db.get(HarvestListing, match.harvest_id)
        if harvest and harvest.status == HarvestStatus.ready:
            harvest.status = HarvestStatus.matched
            logger.info(
                "harvest_status_cascade",
                harvest_id=str(match.harvest_id),
                new_status="matched",
                reason="match_confirmed",
            )

        demand = await self.db.get(DemandPosting, match.demand_id)
        if demand and demand.status in (DemandStatus.open, DemandStatus.reviewing):
            demand.status = DemandStatus.confirmed
            logger.info(
                "demand_status_cascade",
                demand_id=str(match.demand_id),
                new_status="confirmed",
                reason="match_confirmed",
            )

    async def _cascade_fulfilled(self, match: Match) -> None:
        """When a match is fulfilled: harvest→'fulfilled', demand→'fulfilled' if all matches fulfilled."""
        harvest = await self.db.get(HarvestListing, match.harvest_id)
        if harvest and harvest.status == HarvestStatus.matched:
            harvest.status = HarvestStatus.fulfilled
            logger.info(
                "harvest_status_cascade",
                harvest_id=str(match.harvest_id),
                new_status="fulfilled",
                reason="match_fulfilled",
            )

        # Only move demand to fulfilled if all its non-cancelled matches are fulfilled
        remaining = await self.db.execute(
            select(Match).where(
                and_(
                    Match.demand_id == match.demand_id,
                    Match.id != match.id,
                    Match.status.not_in([MatchStatus.cancelled, MatchStatus.expired, MatchStatus.fulfilled]),
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
                    reason="all_matches_fulfilled",
                )

    async def _cascade_cancelled(self, match: Match) -> None:
        """When a match is cancelled: revert harvest→'ready' if no remaining active matches,
        and demand→'open' if no remaining active matches."""
        active_statuses = [
            MatchStatus.proposed,
            MatchStatus.accepted_farmer,
            MatchStatus.accepted_buyer,
            MatchStatus.confirmed,
            MatchStatus.in_transit,
        ]

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
                    reason="match_cancelled_no_remaining",
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
                    reason="match_cancelled_no_remaining",
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
