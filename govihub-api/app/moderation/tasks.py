"""GoviHub Moderation Tasks — the periodic sweep.

The sweep is the safety net behind the publish-time BackgroundTasks scan. Any
listing whose scan never ran, crashed, or hit an AI outage is left at
`pending_scan` and gets picked up here on the next cycle.
"""

from __future__ import annotations

import structlog
from sqlalchemy import func, select, tuple_

from app.listings.models import HarvestListing
from app.marketplace.models import SupplyListing
from app.moderation.models import STATUS_PENDING, ModerationEvent
from app.moderation.service import VERDICT_ERROR, scan_listing

logger = structlog.get_logger()

# Cap per cycle so one backlog burst cannot spend the whole AI budget at once.
SWEEP_BATCH_SIZE = 25


# Give up automatic re-scanning after this many recorded errors for one listing.
MAX_SCAN_ATTEMPTS = 3


async def moderation_sweep() -> int:
    """Scan listings sitting at `pending_scan` in both tables.

    Returns the number of listings scanned. Never raises — one bad listing must
    not abort the batch, and the scheduler keeps running either way.
    """
    from app.database import async_session_factory

    scanned = 0
    async with async_session_factory() as db:
        targets: list[tuple[str, object]] = []

        for listing_type, model in (("supply", SupplyListing), ("harvest", HarvestListing)):
            result = await db.execute(
                select(model.id)
                .where(model.moderation_status == STATUS_PENDING)
                .order_by(model.created_at.asc())
                .limit(SWEEP_BATCH_SIZE)
            )
            targets.extend((listing_type, row) for row in result.scalars().all())

        # Retry cap. A listing whose scan keeps failing (revoked key, exhausted
        # OpenRouter credit, model outage) would otherwise be re-scanned every
        # cycle forever, writing event rows each pass. After MAX_SCAN_ATTEMPTS
        # failures we stop retrying it. The listing stays LIVE and stays
        # pending_scan — fail-open is deliberate — it is simply no longer
        # re-attempted automatically. An admin can still flag it by hand.
        if targets:
            err_rows = await db.execute(
                select(
                    ModerationEvent.listing_type,
                    ModerationEvent.listing_id,
                    func.count().label("n"),
                )
                .where(
                    ModerationEvent.verdict == VERDICT_ERROR,
                    tuple_(ModerationEvent.listing_type, ModerationEvent.listing_id).in_(
                        [(lt, lid) for lt, lid in targets]
                    ),
                )
                .group_by(ModerationEvent.listing_type, ModerationEvent.listing_id)
            )
            exhausted = {
                (r.listing_type, r.listing_id)
                for r in err_rows.all()
                if r.n >= MAX_SCAN_ATTEMPTS
            }
            if exhausted:
                logger.warning(
                    "moderation_sweep_retry_cap_reached",
                    count=len(exhausted),
                    note="listings left live and unscanned; check OpenRouter credit/key",
                )
                targets = [t for t in targets if t not in exhausted]

        for listing_type, listing_id in targets:
            try:
                verdict = await scan_listing(db, listing_type, listing_id)
                await db.commit()
                scanned += 1
                logger.info(
                    "moderation_sweep_scanned",
                    listing_type=listing_type, listing_id=str(listing_id), verdict=verdict,
                )
            except Exception as exc:  # noqa: BLE001
                await db.rollback()
                logger.error(
                    "moderation_sweep_item_failed",
                    listing_type=listing_type, listing_id=str(listing_id), error=str(exc),
                )

    return scanned
