"""GoviHub Matching Tasks — Background jobs that invoke the matching engine."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.matching.engine import SCORE_THRESHOLD, MatchingEngine
from app.matching.models import Match, MatchStatus

logger = structlog.get_logger()


async def run_matching_for_new_listing(
    listing_type: Literal["harvest", "demand"],
    listing_id: UUID,
) -> int:
    """Load listing, run the engine, persist Match rows for score > SCORE_THRESHOLD.

    Returns the number of new Match records created.
    Designed to be called from background tasks / Celery / ARQ workers; opens its
    own DB session so it can be called outside the request lifecycle.
    """
    async with async_session_factory() as db:
        try:
            created = await _run_matching(db, listing_type, listing_id)
            await db.commit()
            return created
        except Exception:
            await db.rollback()
            raise


async def run_matching_inline(
    db: AsyncSession,
    listing_type: Literal["harvest", "demand"],
    listing_id: UUID,
) -> int:
    """Run matching synchronously within the caller's DB session.

    Unlike run_matching_for_new_listing(), this does NOT open a new session
    or commit — matches are flushed into the caller's transaction so they
    exist before the HTTP response is sent.  Use inside request handlers
    where matches must be available immediately.
    """
    engine = MatchingEngine(db)

    if listing_type == "demand":
        candidates = await engine.find_matches_for_demand(listing_id)
    else:
        candidates = await engine.find_matches_for_harvest(listing_id)

    created = 0
    for candidate in candidates:
        if candidate["score"] < SCORE_THRESHOLD:
            continue

        harvest_id = candidate["harvest_id"]
        demand_id = candidate["demand_id"]

        # Skip if a Match already exists for this pair
        existing = await db.execute(
            select(Match).where(
                Match.harvest_id == harvest_id,
                Match.demand_id == demand_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue

        try:
            async with db.begin_nested():
                match = Match(
                    harvest_id=harvest_id,
                    demand_id=demand_id,
                    score=candidate["score"],
                    score_breakdown=candidate["score_breakdown"],
                    status=MatchStatus.proposed,
                )
                db.add(match)
                await db.flush()
            created += 1
            logger.info(
                "match_created_inline",
                harvest_id=str(harvest_id),
                demand_id=str(demand_id),
                score=candidate["score"],
            )
        except IntegrityError:
            logger.debug(
                "match_already_exists",
                harvest_id=str(harvest_id),
                demand_id=str(demand_id),
            )

    return created


async def _run_matching(
    db: AsyncSession,
    listing_type: Literal["harvest", "demand"],
    listing_id: UUID,
) -> int:
    """Internal: run engine and upsert Match rows, return count of new rows."""
    engine = MatchingEngine(db)

    if listing_type == "demand":
        candidates = await engine.find_matches_for_demand(listing_id)
    else:
        candidates = await engine.find_matches_for_harvest(listing_id)

    created = 0
    for candidate in candidates:
        if candidate["score"] < SCORE_THRESHOLD:
            continue

        harvest_id = candidate["harvest_id"]
        demand_id = candidate["demand_id"]

        # Skip if a Match already exists for this pair
        existing = await db.execute(
            select(Match).where(
                Match.harvest_id == harvest_id,
                Match.demand_id == demand_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue

        match = Match(
            harvest_id=harvest_id,
            demand_id=demand_id,
            score=candidate["score"],
            score_breakdown=candidate["score_breakdown"],
            status=MatchStatus.proposed,
        )
        db.add(match)

        try:
            await db.flush()
            created += 1
            logger.info(
                "match_created",
                harvest_id=str(harvest_id),
                demand_id=str(demand_id),
                score=candidate["score"],
            )
        except IntegrityError:
            # Unique constraint: another process already created this pair
            await db.rollback()
            logger.debug(
                "match_already_exists",
                harvest_id=str(harvest_id),
                demand_id=str(demand_id),
            )

    return created
