"""GoviHub Admin — flagged-listing queue.

Reads flagged rows out of BOTH listing tables and merges them into one page.
The two tables have different shapes (name vs variety, supplier vs farmer), so
each is normalised to the same item dict before merging.
"""

from __future__ import annotations

import math

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.listings.models import CropTaxonomy, HarvestListing
from app.marketplace.models import SupplyListing
from app.moderation.models import STATUS_FLAGGED, ModerationEvent
from app.users.models import User


async def _last_reasons(db: AsyncSession, keys: list[tuple[str, object]]) -> dict:
    """Most recent moderation_events.reason per (listing_type, listing_id).

    One query for the whole page — DISTINCT ON is the cheap way to take the
    newest row per listing in Postgres.
    """
    if not keys:
        return {}
    ids = [k[1] for k in keys]
    stmt = (
        select(
            ModerationEvent.listing_type,
            ModerationEvent.listing_id,
            ModerationEvent.reason,
        )
        .where(ModerationEvent.listing_id.in_(ids))
        .distinct(ModerationEvent.listing_type, ModerationEvent.listing_id)
        .order_by(
            ModerationEvent.listing_type,
            ModerationEvent.listing_id,
            ModerationEvent.created_at.desc(),
        )
    )
    result = await db.execute(stmt)
    return {(r.listing_type, r.listing_id): r.reason for r in result.all()}


async def list_flagged(db: AsyncSession, page: int = 1, size: int = 25) -> dict:
    """Paginated flagged listings across supply_listings and harvest_listings."""
    supply_stmt = (
        select(SupplyListing, User.name)
        .join(User, User.id == SupplyListing.supplier_id, isouter=True)
        .where(SupplyListing.moderation_status == STATUS_FLAGGED)
    )
    harvest_stmt = (
        select(HarvestListing, User.name, CropTaxonomy.name_en)
        .join(User, User.id == HarvestListing.farmer_id, isouter=True)
        .join(CropTaxonomy, CropTaxonomy.id == HarvestListing.crop_id, isouter=True)
        .where(HarvestListing.moderation_status == STATUS_FLAGGED)
    )

    items: list[dict] = []

    for listing, owner_name in (await db.execute(supply_stmt)).all():
        items.append(
            {
                "listing_type": "supply",
                "id": listing.id,
                "name": listing.name,
                "supplier_or_farmer_name": owner_name,
                "moderation_status": listing.moderation_status,
                "status": getattr(listing.status, "value", str(listing.status)),
                "created_at": listing.created_at,
                "last_reason": None,
            }
        )

    for listing, owner_name, crop_name in (await db.execute(harvest_stmt)).all():
        title = " ".join(p for p in (crop_name, listing.variety) if p) or "Harvest listing"
        items.append(
            {
                "listing_type": "harvest",
                "id": listing.id,
                "name": title,
                "supplier_or_farmer_name": owner_name,
                "moderation_status": listing.moderation_status,
                "status": getattr(listing.status, "value", str(listing.status)),
                "created_at": listing.created_at,
                "last_reason": None,
            }
        )

    # Newest first. Sorting in Python is safe here: the flagged queue is a
    # human review backlog, not a bulk surface.
    items.sort(key=lambda i: i["created_at"], reverse=True)

    total = len(items)
    start = (page - 1) * size
    page_items = items[start : start + size]

    reasons = await _last_reasons(db, [(i["listing_type"], i["id"]) for i in page_items])
    for item in page_items:
        item["last_reason"] = reasons.get((item["listing_type"], item["id"]))

    return {
        "items": page_items,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if size else 0,
    }
