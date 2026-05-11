"""Admin listing moderation operations.

Three pairs of operations for the three marketplace listing kinds:
    harvest_listings     (farmer-supplied crops)            -> HarvestListing
    demand_postings      (buyer requests)                   -> DemandPosting
    supply_listings      (supplier inputs/services)         -> SupplyListing

Moderation does NOT mutate the lifecycle status enum — instead it stamps the
removal trio (removal_reason, removed_by, removed_at) added in migration 012.
List endpoints exclude removed rows by default; pass include_removed=True to
see them (audit view).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

import structlog
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError, ValidationError
from app.listings.models import (
    CropTaxonomy,
    DemandPosting,
    HarvestListing,
)
from app.marketplace.models import SupplyListing
from app.users.models import User

logger = structlog.get_logger()


# Canonical free-text categories the admin panel surfaces. Free text in
# `notes` lets admins record unusual cases without polluting this list.
REMOVAL_REASONS = {
    "spam",
    "duplicate",
    "fraud",
    "policy_violation",
    "user_request",
    "stale",
    "other",
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _validate_reason(reason: str) -> None:
    if reason not in REMOVAL_REASONS:
        raise ValidationError(
            detail=f"Invalid removal reason. Allowed: {sorted(REMOVAL_REASONS)}"
        )


def _paginate(query, page: int, size: int):
    return query.offset((page - 1) * size).limit(size)


async def _count(db: AsyncSession, base_query) -> int:
    r = await db.execute(select(func.count()).select_from(base_query.subquery()))
    return int(r.scalar_one())


# ---------------------------------------------------------------------------
# Harvest listings (farmers selling crops)
# ---------------------------------------------------------------------------


async def list_harvest_listings(
    db: AsyncSession,
    *,
    search: Optional[str] = None,
    crop_id: Optional[UUID] = None,
    status: Optional[str] = None,
    include_removed: bool = False,
    page: int = 1,
    size: int = 20,
) -> dict[str, Any]:
    """Paginated harvest listings with farmer + crop join for the admin grid."""
    query = (
        select(HarvestListing, User, CropTaxonomy)
        .join(User, User.id == HarvestListing.farmer_id)
        .outerjoin(CropTaxonomy, CropTaxonomy.id == HarvestListing.crop_id)
    )
    if not include_removed:
        query = query.where(HarvestListing.removed_at.is_(None))
    if status:
        query = query.where(HarvestListing.status == status)
    if crop_id:
        query = query.where(HarvestListing.crop_id == crop_id)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                User.name.ilike(pattern),
                User.email.ilike(pattern),
                HarvestListing.variety.ilike(pattern),
                HarvestListing.description.ilike(pattern),
            )
        )

    total = await _count(db, query)

    query = query.order_by(HarvestListing.created_at.desc())
    query = _paginate(query, page, size)

    rows = (await db.execute(query)).all()
    items = [_serialize_harvest(hl, farmer, crop) for hl, farmer, crop in rows]
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if size else 0,
    }


async def remove_harvest_listing(
    db: AsyncSession,
    listing_id: UUID,
    reason: str,
    notes: Optional[str],
    admin_id: UUID,
) -> dict[str, Any]:
    _validate_reason(reason)
    listing = await db.get(HarvestListing, listing_id)
    if listing is None:
        raise NotFoundError(detail=f"Harvest listing {listing_id} not found")

    full_reason = f"{reason}: {notes}" if notes else reason
    listing.removal_reason = full_reason
    listing.removed_by = admin_id
    listing.removed_at = datetime.now(timezone.utc)
    await db.flush()
    logger.info(
        "admin_listing_removed",
        listing_kind="harvest",
        listing_id=str(listing_id),
        admin_id=str(admin_id),
        reason=reason,
    )
    return _serialize_harvest(listing, None, None)


def _normalise_images(raw: Any) -> list[str]:
    """JSONB images columns may hold string[] or [{url}]. Normalise to URL list."""
    if not raw:
        return []
    if isinstance(raw, list):
        out: list[str] = []
        for item in raw:
            if isinstance(item, str) and item:
                out.append(item)
            elif isinstance(item, dict):
                u = item.get("url")
                if isinstance(u, str) and u:
                    out.append(u)
        return out
    return []


def _serialize_harvest(
    hl: HarvestListing,
    farmer: Optional[User],
    crop: Optional[CropTaxonomy],
) -> dict[str, Any]:
    return {
        "id": str(hl.id),
        "kind": "harvest",
        "farmer_id": str(hl.farmer_id),
        "farmer_name": farmer.name if farmer else None,
        "farmer_email": farmer.email if farmer else None,
        "farmer_phone": farmer.phone if farmer else None,
        "farmer_district": farmer.district if farmer else None,
        "crop_id": str(hl.crop_id) if hl.crop_id else None,
        "crop_name": crop.name_en if crop else None,
        "crop_name_si": crop.name_si if crop else None,
        "variety": hl.variety,
        "quantity_kg": float(hl.quantity_kg) if hl.quantity_kg is not None else None,
        "price_per_kg": float(hl.price_per_kg) if hl.price_per_kg is not None else None,
        "min_price_per_kg": float(hl.min_price_per_kg) if hl.min_price_per_kg is not None else None,
        "quality_grade": hl.quality_grade,
        "harvest_date": hl.harvest_date.isoformat() if hl.harvest_date else None,
        "available_from": hl.available_from.isoformat() if hl.available_from else None,
        "available_until": hl.available_until.isoformat() if hl.available_until else None,
        "description": hl.description,
        "images": _normalise_images(hl.images),
        "status": hl.status.value if hasattr(hl.status, "value") else str(hl.status),
        "is_organic": hl.is_organic,
        "delivery_available": hl.delivery_available,
        "delivery_radius_km": hl.delivery_radius_km,
        "created_at": hl.created_at.isoformat() if hl.created_at else None,
        "removal_reason": hl.removal_reason,
        "removed_by": str(hl.removed_by) if hl.removed_by else None,
        "removed_at": hl.removed_at.isoformat() if hl.removed_at else None,
    }


# ---------------------------------------------------------------------------
# Demand postings (buyers requesting crops)
# ---------------------------------------------------------------------------


async def list_demand_postings(
    db: AsyncSession,
    *,
    search: Optional[str] = None,
    crop_id: Optional[UUID] = None,
    status: Optional[str] = None,
    include_removed: bool = False,
    page: int = 1,
    size: int = 20,
) -> dict[str, Any]:
    query = (
        select(DemandPosting, User, CropTaxonomy)
        .join(User, User.id == DemandPosting.buyer_id)
        .outerjoin(CropTaxonomy, CropTaxonomy.id == DemandPosting.crop_id)
    )
    if not include_removed:
        query = query.where(DemandPosting.removed_at.is_(None))
    if status:
        query = query.where(DemandPosting.status == status)
    if crop_id:
        query = query.where(DemandPosting.crop_id == crop_id)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                User.name.ilike(pattern),
                User.email.ilike(pattern),
                DemandPosting.variety.ilike(pattern),
                DemandPosting.description.ilike(pattern),
            )
        )

    total = await _count(db, query)
    query = query.order_by(DemandPosting.created_at.desc())
    query = _paginate(query, page, size)
    rows = (await db.execute(query)).all()
    items = [_serialize_demand(dp, buyer, crop) for dp, buyer, crop in rows]
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if size else 0,
    }


async def remove_demand_posting(
    db: AsyncSession,
    posting_id: UUID,
    reason: str,
    notes: Optional[str],
    admin_id: UUID,
) -> dict[str, Any]:
    _validate_reason(reason)
    posting = await db.get(DemandPosting, posting_id)
    if posting is None:
        raise NotFoundError(detail=f"Demand posting {posting_id} not found")

    posting.removal_reason = f"{reason}: {notes}" if notes else reason
    posting.removed_by = admin_id
    posting.removed_at = datetime.now(timezone.utc)
    await db.flush()
    logger.info(
        "admin_listing_removed",
        listing_kind="demand",
        listing_id=str(posting_id),
        admin_id=str(admin_id),
        reason=reason,
    )
    return _serialize_demand(posting, None, None)


def _serialize_demand(
    dp: DemandPosting,
    buyer: Optional[User],
    crop: Optional[CropTaxonomy],
) -> dict[str, Any]:
    return {
        "id": str(dp.id),
        "kind": "demand",
        "buyer_id": str(dp.buyer_id),
        "buyer_name": buyer.name if buyer else None,
        "buyer_email": buyer.email if buyer else None,
        "buyer_phone": buyer.phone if buyer else None,
        "buyer_district": buyer.district if buyer else None,
        "crop_id": str(dp.crop_id) if dp.crop_id else None,
        "crop_name": crop.name_en if crop else None,
        "crop_name_si": crop.name_si if crop else None,
        "variety": dp.variety,
        "quantity_kg": float(dp.quantity_kg) if dp.quantity_kg is not None else None,
        "max_price_per_kg": float(dp.max_price_per_kg)
        if dp.max_price_per_kg is not None
        else None,
        "quality_grade": dp.quality_grade,
        "needed_by": dp.needed_by.isoformat() if dp.needed_by else None,
        "radius_km": dp.radius_km,
        "is_recurring": dp.is_recurring,
        "description": dp.description,
        "status": dp.status.value if hasattr(dp.status, "value") else str(dp.status),
        "created_at": dp.created_at.isoformat() if dp.created_at else None,
        "removal_reason": dp.removal_reason,
        "removed_by": str(dp.removed_by) if dp.removed_by else None,
        "removed_at": dp.removed_at.isoformat() if dp.removed_at else None,
    }


# ---------------------------------------------------------------------------
# Supply listings (suppliers selling inputs/services)
# ---------------------------------------------------------------------------


async def list_supply_listings(
    db: AsyncSession,
    *,
    search: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    include_removed: bool = False,
    page: int = 1,
    size: int = 20,
) -> dict[str, Any]:
    query = select(SupplyListing, User).join(
        User, User.id == SupplyListing.supplier_id
    )
    if not include_removed:
        query = query.where(SupplyListing.removed_at.is_(None))
    if status:
        query = query.where(SupplyListing.status == status)
    if category:
        query = query.where(SupplyListing.category == category)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                User.name.ilike(pattern),
                User.email.ilike(pattern),
                SupplyListing.name.ilike(pattern),
                SupplyListing.description.ilike(pattern),
            )
        )

    total = await _count(db, query)
    query = query.order_by(SupplyListing.created_at.desc())
    query = _paginate(query, page, size)
    rows = (await db.execute(query)).all()
    items = [_serialize_supply(sl, supplier) for sl, supplier in rows]
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if size else 0,
    }


async def remove_supply_listing(
    db: AsyncSession,
    listing_id: UUID,
    reason: str,
    notes: Optional[str],
    admin_id: UUID,
) -> dict[str, Any]:
    _validate_reason(reason)
    listing = await db.get(SupplyListing, listing_id)
    if listing is None:
        raise NotFoundError(detail=f"Supply listing {listing_id} not found")

    listing.removal_reason = f"{reason}: {notes}" if notes else reason
    listing.removed_by = admin_id
    listing.removed_at = datetime.now(timezone.utc)
    await db.flush()
    logger.info(
        "admin_listing_removed",
        listing_kind="supply",
        listing_id=str(listing_id),
        admin_id=str(admin_id),
        reason=reason,
    )
    return _serialize_supply(listing, None)


def _serialize_supply(
    sl: SupplyListing,
    supplier: Optional[User],
) -> dict[str, Any]:
    return {
        "id": str(sl.id),
        "kind": "supply",
        "supplier_id": str(sl.supplier_id),
        "supplier_name": supplier.name if supplier else None,
        "supplier_email": supplier.email if supplier else None,
        "supplier_phone": supplier.phone if supplier else None,
        "supplier_district": supplier.district if supplier else None,
        "name": sl.name,
        "name_si": sl.name_si,
        "description": sl.description,
        "category": sl.category.value if hasattr(sl.category, "value") else str(sl.category),
        "price": float(sl.price) if sl.price is not None else None,
        "unit": sl.unit,
        "stock_quantity": sl.stock_quantity,
        "images": _normalise_images(sl.images),
        "delivery_available": sl.delivery_available,
        "delivery_radius_km": sl.delivery_radius_km,
        "status": sl.status.value if hasattr(sl.status, "value") else str(sl.status),
        "created_at": sl.created_at.isoformat() if sl.created_at else None,
        "removal_reason": sl.removal_reason,
        "removed_by": str(sl.removed_by) if sl.removed_by else None,
        "removed_at": sl.removed_at.isoformat() if sl.removed_at else None,
    }
