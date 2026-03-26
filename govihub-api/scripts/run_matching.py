#!/usr/bin/env python3
"""Batch matching: process listings that haven't been matched yet.

Can be run standalone (``python scripts/run_matching.py``) or imported by the
periodic scheduler inside ``app.main``.
"""

import asyncio
import logging
import os
import sys

# Ensure the project root is on sys.path so ``app.*`` imports work when
# executed directly (outside Docker the CWD may differ).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("matching_batch")


async def run_batch_matching() -> int:
    """Find unmatched ready harvests and open demands, then run the engine.

    Returns the total number of new Match records created.
    """
    from sqlalchemy import text

    # Import ALL models so SQLAlchemy relationship strings resolve correctly
    import app.users.models  # noqa: F401
    import app.listings.models  # noqa: F401
    import app.marketplace.models  # noqa: F401
    import app.matching.models  # noqa: F401
    import app.diagnosis.models  # noqa: F401
    import app.feedback.models  # noqa: F401
    try:
        import app.auth.models  # noqa: F401
    except ImportError:
        pass  # auth models may not exist in all setups
    try:
        import app.notifications.models  # noqa: F401
    except ImportError:
        pass

    from app.database import async_session_factory
    from app.matching.tasks import run_matching_for_new_listing

    async with async_session_factory() as db:
        # Ready harvests that have zero matches yet
        unmatched_harvests = await db.execute(text("""
            SELECT hl.id FROM harvest_listings hl
            WHERE hl.status = 'ready'
              AND hl.id NOT IN (SELECT DISTINCT harvest_id FROM matches)
        """))
        harvest_ids = [row[0] for row in unmatched_harvests.fetchall()]

        # Open demands that have zero matches yet
        unmatched_demands = await db.execute(text("""
            SELECT dp.id FROM demand_postings dp
            WHERE dp.status = 'open'
              AND dp.id NOT IN (SELECT DISTINCT demand_id FROM matches)
        """))
        demand_ids = [row[0] for row in unmatched_demands.fetchall()]

    if not harvest_ids and not demand_ids:
        logger.info("No new listings to match")
        return 0

    logger.info(
        "Processing %d new harvests + %d new demands",
        len(harvest_ids),
        len(demand_ids),
    )

    new_matches = 0

    for h_id in harvest_ids:
        try:
            count = await run_matching_for_new_listing("harvest", h_id)
            new_matches += count
        except Exception as e:
            logger.error("Failed matching harvest %s: %s", h_id, e)

    for d_id in demand_ids:
        try:
            count = await run_matching_for_new_listing("demand", d_id)
            new_matches += count
        except Exception as e:
            logger.error("Failed matching demand %s: %s", d_id, e)

    logger.info("Batch complete: %d new matches", new_matches)
    return new_matches


if __name__ == "__main__":
    result = asyncio.run(run_batch_matching())
    print(f"Created {result} matches")
