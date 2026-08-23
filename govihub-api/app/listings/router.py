"""GoviHub Listings Router — Reference data (crops, districts) + Harvest/Demand CRUD."""

import math
from datetime import date
from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_complete_profile, require_role
from app.exceptions import ForbiddenError, GoviHubException, ValidationError
from app.listings.models import CropTaxonomy, HarvestStatus
from app.listings.schemas import (
    DemandPostingCreate,
    DemandPostingRead,
    DemandPostingUpdate,
    DemandStatusUpdate,
    HarvestListingCreate,
    HarvestListingRead,
    HarvestListingUpdate,
    HarvestStatusUpdate,
)
from app.listings.service import ListingService
from app.matching.tasks import run_matching_for_new_listing, run_matching_inline
from app.utils.pagination import PaginationMeta, PaginationParams, paginate
from app.utils.sri_lanka import get_districts_list

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# District centre coordinates (lng, lat) for location fallback
# ---------------------------------------------------------------------------

DISTRICT_COORDS: dict[str, tuple[float, float]] = {
    # North Central Province (pilot)
    "Anuradhapura": (80.4037, 8.3114),
    "Polonnaruwa": (81.0188, 7.9403),
    # Western Province
    "Colombo": (79.8612, 6.9271),
    "Gampaha": (80.0137, 7.0840),
    "Kalutara": (80.1486, 6.5854),
    # Central Province
    "Kandy": (80.6350, 7.2906),
    "Matale": (80.6234, 7.4675),
    "Nuwara Eliya": (80.7673, 6.9497),
    # Southern Province
    "Galle": (80.2170, 6.0535),
    "Matara": (80.5353, 5.9549),
    "Hambantota": (81.1185, 6.1429),
    # Northern Province
    "Jaffna": (80.0255, 9.6615),
    "Kilinochchi": (80.3770, 9.3803),
    "Mannar": (79.9083, 8.9810),
    "Mullaitivu": (80.5671, 9.2671),
    "Vavuniya": (80.4971, 8.7514),
    # Eastern Province
    "Batticaloa": (81.6924, 7.7310),
    "Ampara": (81.6747, 7.2975),
    "Trincomalee": (81.2152, 8.5874),
    # North Western Province
    "Kurunegala": (80.3636, 7.4863),
    "Puttalam": (79.8283, 8.0362),
    # Uva Province
    "Badulla": (81.0550, 6.9934),
    "Monaragala": (81.3507, 6.8728),
    # Sabaragamuwa Province
    "Ratnapura": (80.3984, 6.6828),
    "Kegalle": (80.3464, 7.2513),
}

router = APIRouter()


# ---------------------------------------------------------------------------
# Reference Data — Crops & Districts
# ---------------------------------------------------------------------------

@router.get("/crops", tags=["Reference Data"])
async def list_crops(
    category: str = Query(None, description="Filter by category"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """List all active crops (paginated, filterable by category)."""
    query = select(CropTaxonomy).where(CropTaxonomy.is_active == True)
    count_query = (
        select(func.count()).select_from(CropTaxonomy).where(CropTaxonomy.is_active == True)
    )

    if category:
        query = query.where(CropTaxonomy.category == category)
        count_query = count_query.where(CropTaxonomy.category == category)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.offset(pagination.offset).limit(pagination.size)
    result = await db.execute(query)
    crops = result.scalars().all()

    return paginate(crops, total, pagination)


@router.get("/crops/{crop_id}", tags=["Reference Data"])
async def get_crop(
    crop_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get single crop detail."""
    result = await db.execute(select(CropTaxonomy).where(CropTaxonomy.id == crop_id))
    crop = result.scalar_one_or_none()
    if not crop:
        from app.exceptions import NotFoundError
        raise NotFoundError(detail="Crop not found")
    return crop


@router.get("/districts", tags=["Reference Data"])
async def list_districts():
    """List all Sri Lankan districts with province mapping."""
    return {"data": get_districts_list()}


# ---------------------------------------------------------------------------
# Image Upload
# ---------------------------------------------------------------------------

# Purposes an authenticated user may upload against. This is an ALLOWLIST:
# the old free-form `folder` query param let any complete-profile user write to
# any prefix in the bucket (including ones belonging to other features), with no
# binding to the uploader. Marketplace and ad images have their own scoped,
# resource-bound endpoints and are deliberately NOT reachable from here.
UPLOAD_PURPOSES = {"harvests", "demands"}
UPLOAD_RATE_LIMIT_PER_HOUR = 60


def user_upload_prefix(purpose: str, user_id) -> str:
    """Storage prefix that binds an uploaded object to one user and purpose."""
    return f"{purpose}/{user_id}"


def assert_images_belong_to(images, user_id) -> None:
    """Attach-time check: every image URL must sit under this user's prefix.

    Without this the per-user upload prefix would be decorative — a caller could
    still attach a URL somebody else uploaded. Pre-existing images uploaded
    before this binding shipped live under the old flat ``harvests/`` prefix and
    are still accepted, so already-published listings keep their photos.
    """
    if not images:
        return
    for url in images:
        if not isinstance(url, str):
            raise ValidationError(detail="Image entries must be URL strings")

        segments = url.split("/")
        owner = None
        for purpose in UPLOAD_PURPOSES:
            if purpose in segments:
                idx = segments.index(purpose)
                # Bound key: .../{purpose}/{user_id}/{file}  -> 2 segments after
                # Legacy key: .../{purpose}/{file}           -> 1 segment after
                if len(segments) - idx - 1 == 2:
                    owner = segments[idx + 1]
                break

        # Legacy flat keys predate this binding and carry no owner segment;
        # already-published listings keep their photos.
        if owner is None:
            continue
        if owner == str(user_id):
            continue
        raise ValidationError(
            detail="Image URL does not belong to you. Upload the image again.",
            details={"url": url},
        )


@router.post("/uploads/image", tags=["Listings"])
async def upload_listing_image(
    purpose: Optional[str] = Query(
        None, description="Upload purpose: harvests | demands"
    ),
    folder: Optional[str] = Query(
        None, description="Deprecated alias for `purpose`; kept so already-loaded browser bundles keep working"
    ),
    file: UploadFile = File(..., description="JPEG, PNG or WebP image, max 10 MB"),
    current_user=Depends(require_complete_profile),
):
    """Upload an image for a listing being composed, before the listing exists.

    Harvest and demand forms collect photos before the record is created, so the
    object cannot be keyed by resource id. It is keyed by uploader instead:
    ``{purpose}/{user_id}/{uuid}.{ext}``. Attach time re-checks that prefix, so a
    URL uploaded by one user cannot be attached to another user's listing.
    """
    from app.dependencies import get_redis
    from app.utils.storage import storage_service

    chosen = (purpose or folder or "").strip().lower()
    if chosen not in UPLOAD_PURPOSES:
        raise ValidationError(
            detail=f"Unsupported upload purpose '{chosen or '(none)'}'.",
            details={"allowed": sorted(UPLOAD_PURPOSES)},
        )

    # Per-user hourly cap (same Redis counter pattern as the admin AI query).
    try:
        redis = await get_redis()
        key = f"upload_rate:{current_user.id}"
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, 3600)
        if count > UPLOAD_RATE_LIMIT_PER_HOUR:
            raise GoviHubException(
                status_code=429,
                detail=f"Upload limit reached ({UPLOAD_RATE_LIMIT_PER_HOUR}/hour). Try again later.",
                error_code="UPLOAD_RATE_LIMITED",
            )
    except GoviHubException:
        raise
    except Exception as exc:  # noqa: BLE001 — Redis outage must not block uploads
        logger.warning("upload_rate_limit_unavailable", error=str(exc))

    file_bytes = await file.read()
    content_type = file.content_type or "application/octet-stream"

    # storage_service enforces JPEG/PNG/WebP and the size ceiling.
    url = await storage_service.upload_image(
        file_bytes=file_bytes,
        content_type=content_type,
        folder=user_upload_prefix(chosen, current_user.id),
    )
    return {"url": url, "folder": chosen, "purpose": chosen}


# ---------------------------------------------------------------------------
# Harvest Listings — Farmer CRUD
# ---------------------------------------------------------------------------

@router.post(
    "/listings/harvest",
    response_model=HarvestListingRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Listings"],
)
async def create_harvest_listing(
    data: HarvestListingCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("farmer")),
):
    """Create a new harvest listing. Requires farmer role."""
    data_dict = data.model_dump()
    assert_images_belong_to(data_dict.get("images"), current_user.id)

    # Auto-set location from farmer's district when no coordinates provided
    if not data_dict.get("latitude") and not data_dict.get("longitude") and current_user.district:
        coords = DISTRICT_COORDS.get(current_user.district)
        if coords:
            data_dict["longitude"] = coords[0]
            data_dict["latitude"] = coords[1]

    # Auto-promote to ready for immediate matching (pilot simplification)
    if data_dict.get("status") in (None, "planned"):
        data_dict["status"] = "ready"

    svc = ListingService(db)
    listing = await svc.create_harvest(
        farmer_id=current_user.id,
        data=data_dict,
    )

    # Run matching engine inline so matches exist before response is sent
    if str(listing.status) in ("ready", "HarvestStatus.ready", "planned", "HarvestStatus.planned"):
        await db.flush()  # ensure listing is visible to engine SQL queries
        count = await run_matching_inline(db, "harvest", listing.id)
        logger.info("matching_inline", listing_type="harvest", listing_id=str(listing.id), matches_created=count)

    return _harvest_to_read(listing)


@router.get(
    "/listings/harvest",
    tags=["Listings"],
)
async def list_my_harvests(
    status: Optional[str] = Query(None, description="Filter by status"),
    crop_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("farmer")),
):
    """List the current farmer's own harvest listings."""
    svc = ListingService(db)
    listings, total = await svc.list_my_harvests(
        farmer_id=current_user.id,
        status=status,
        crop_id=crop_id,
        page=page,
        size=size,
    )
    return {
        "data": [_harvest_to_read(l) for l in listings],
        "meta": PaginationMeta(
            page=page,
            size=size,
            total=total,
            pages=math.ceil(total / size) if size else 0,
        ),
    }


@router.get(
    "/listings/harvest/browse",
    tags=["Listings"],
)
async def browse_harvests(
    crop_id: Optional[UUID] = Query(None),
    category: Optional[str] = Query(None),
    is_organic: Optional[bool] = Query(None),
    quality_grade: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    available_from: Optional[date] = Query(None),
    available_until: Optional[date] = Query(None),
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
    radius_km: Optional[float] = Query(None, gt=0, le=500),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_complete_profile),
):
    """Browse active harvest listings (buyers/public view) with optional geo filter."""
    if (latitude is None) != (longitude is None):
        raise ValidationError(detail="Both latitude and longitude must be supplied together")

    svc = ListingService(db)
    filters = dict(
        crop_id=crop_id,
        category=category,
        is_organic=is_organic,
        quality_grade=quality_grade,
        min_price=min_price,
        max_price=max_price,
        available_from=available_from,
        available_until=available_until,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
    )
    listings, total = await svc.list_all_harvests(filters=filters, page=page, size=size)
    return {
        "data": [_harvest_to_read(l) for l in listings],
        "meta": PaginationMeta(
            page=page,
            size=size,
            total=total,
            pages=math.ceil(total / size) if size else 0,
        ),
    }


@router.get(
    "/listings/harvest/{listing_id}",
    response_model=HarvestListingRead,
    tags=["Listings"],
)
async def get_harvest_listing(
    listing_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_complete_profile),
):
    """Get a single harvest listing by ID."""
    svc = ListingService(db)
    listing = await svc.get_harvest(listing_id)
    return _harvest_to_read(listing)


@router.put(
    "/listings/harvest/{listing_id}",
    response_model=HarvestListingRead,
    tags=["Listings"],
)
async def update_harvest_listing(
    listing_id: UUID,
    data: HarvestListingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("farmer")),
):
    """Update a harvest listing. Owner only; only planned/ready listings."""
    assert_images_belong_to(data.images, current_user.id)
    svc = ListingService(db)
    listing = await svc.update_harvest(
        listing_id=listing_id,
        farmer_id=current_user.id,
        data=data.model_dump(exclude_none=True),
    )

    # Auto-promote planned → ready on update (pilot simplification)
    if str(listing.status) in ("planned", "HarvestStatus.planned"):
        listing.status = HarvestStatus.ready
        await db.flush()

    # Re-run matching when listing is updated (crop/qty/dates may have changed)
    if str(listing.status) in ("ready", "HarvestStatus.ready"):
        await db.flush()
        count = await run_matching_inline(db, "harvest", listing.id)
        logger.info("matching_inline_update", listing_type="harvest", listing_id=str(listing.id), matches_created=count)

    return _harvest_to_read(listing)


@router.patch(
    "/listings/harvest/{listing_id}/status",
    response_model=HarvestListingRead,
    tags=["Listings"],
)
async def update_harvest_status(
    listing_id: UUID,
    data: HarvestStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("farmer")),
):
    """Transition harvest listing status. Validates allowed transitions."""
    svc = ListingService(db)
    listing = await svc.update_harvest_status(
        listing_id=listing_id,
        farmer_id=current_user.id,
        new_status=data.status,
    )

    # Run matching inline when a harvest transitions to "ready"
    if str(listing.status) in ("ready", "HarvestStatus.ready"):
        await db.flush()
        count = await run_matching_inline(db, "harvest", listing.id)
        logger.info("matching_inline_status", listing_type="harvest", listing_id=str(listing.id), matches_created=count)

    return _harvest_to_read(listing)


@router.delete(
    "/listings/harvest/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Listings"],
)
async def delete_harvest_listing(
    listing_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("farmer")),
):
    """Delete a harvest listing. Only planned listings can be hard-deleted."""
    svc = ListingService(db)
    await svc.delete_harvest(listing_id=listing_id, farmer_id=current_user.id)


# ---------------------------------------------------------------------------
# Demand Postings — Buyer CRUD
# ---------------------------------------------------------------------------

@router.post(
    "/listings/demand",
    response_model=DemandPostingRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Listings"],
)
async def create_demand_posting(
    data: DemandPostingCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("buyer")),
):
    """Create a new demand posting. Requires buyer role."""
    data_dict = data.model_dump()

    # Auto-set location from buyer's district when no coordinates provided
    if not data_dict.get("latitude") and not data_dict.get("longitude") and current_user.district:
        coords = DISTRICT_COORDS.get(current_user.district)
        if coords:
            data_dict["longitude"] = coords[0]
            data_dict["latitude"] = coords[1]

    svc = ListingService(db)
    posting = await svc.create_demand(
        buyer_id=current_user.id,
        data=data_dict,
    )

    # Run matching engine inline so matches exist before response is sent
    if str(posting.status) in ("open", "DemandStatus.open"):
        await db.flush()  # ensure demand is visible to engine SQL queries
        count = await run_matching_inline(db, "demand", posting.id)
        logger.info("matching_inline", listing_type="demand", listing_id=str(posting.id), matches_created=count)

    return _demand_to_read(posting)


@router.get(
    "/listings/demand",
    tags=["Listings"],
)
async def list_my_demands(
    status: Optional[str] = Query(None, description="Filter by status"),
    crop_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("buyer")),
):
    """List the current buyer's own demand postings."""
    svc = ListingService(db)
    postings, total = await svc.list_my_demands(
        buyer_id=current_user.id,
        status=status,
        crop_id=crop_id,
        page=page,
        size=size,
    )
    return {
        "data": [_demand_to_read(p) for p in postings],
        "meta": PaginationMeta(
            page=page,
            size=size,
            total=total,
            pages=math.ceil(total / size) if size else 0,
        ),
    }


@router.get(
    "/listings/demand/browse",
    tags=["Listings"],
)
async def browse_demands(
    crop_id: Optional[UUID] = Query(None),
    category: Optional[str] = Query(None),
    quality_grade: Optional[str] = Query(None),
    max_price: Optional[float] = Query(None, ge=0),
    needed_by_before: Optional[date] = Query(None),
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
    radius_km: Optional[float] = Query(None, gt=0, le=500),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_complete_profile),
):
    """Browse active demand postings (farmers/public view) with optional geo filter."""
    if (latitude is None) != (longitude is None):
        raise ValidationError(detail="Both latitude and longitude must be supplied together")

    svc = ListingService(db)
    filters = dict(
        crop_id=crop_id,
        category=category,
        quality_grade=quality_grade,
        max_price=max_price,
        needed_by_before=needed_by_before,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
    )
    postings, total = await svc.list_all_demands(filters=filters, page=page, size=size)
    return {
        "data": [_demand_to_read(p) for p in postings],
        "meta": PaginationMeta(
            page=page,
            size=size,
            total=total,
            pages=math.ceil(total / size) if size else 0,
        ),
    }


@router.get(
    "/listings/demand/{posting_id}",
    response_model=DemandPostingRead,
    tags=["Listings"],
)
async def get_demand_posting(
    posting_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_complete_profile),
):
    """Get a single demand posting by ID."""
    svc = ListingService(db)
    posting = await svc.get_demand(posting_id)
    return _demand_to_read(posting)


@router.put(
    "/listings/demand/{posting_id}",
    response_model=DemandPostingRead,
    tags=["Listings"],
)
async def update_demand_posting(
    posting_id: UUID,
    data: DemandPostingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("buyer")),
):
    """Update a demand posting. Owner only; only open/reviewing postings."""
    svc = ListingService(db)
    posting = await svc.update_demand(
        posting_id=posting_id,
        buyer_id=current_user.id,
        data=data.model_dump(exclude_none=True),
    )

    # Re-run matching when an open demand is updated (crop/qty/dates may have changed)
    if str(posting.status) in ("open", "DemandStatus.open"):
        await db.flush()
        count = await run_matching_inline(db, "demand", posting.id)
        logger.info("matching_inline_update", listing_type="demand", listing_id=str(posting.id), matches_created=count)

    return _demand_to_read(posting)


@router.patch(
    "/listings/demand/{posting_id}/status",
    response_model=DemandPostingRead,
    tags=["Listings"],
)
async def update_demand_status(
    posting_id: UUID,
    data: DemandStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("buyer")),
):
    """Transition demand posting status. Validates allowed transitions."""
    svc = ListingService(db)
    posting = await svc.update_demand_status(
        posting_id=posting_id,
        buyer_id=current_user.id,
        new_status=data.status,
    )

    # Run matching inline when a demand transitions to "open"
    if str(posting.status) in ("open", "DemandStatus.open"):
        await db.flush()
        count = await run_matching_inline(db, "demand", posting.id)
        logger.info("matching_inline_status", listing_type="demand", listing_id=str(posting.id), matches_created=count)

    return _demand_to_read(posting)


@router.delete(
    "/listings/demand/{posting_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Listings"],
)
async def delete_demand_posting(
    posting_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("buyer")),
):
    """Delete a demand posting. Only open postings can be hard-deleted."""
    svc = ListingService(db)
    await svc.delete_demand(posting_id=posting_id, buyer_id=current_user.id)


# ---------------------------------------------------------------------------
# Internal helpers — ORM → Schema conversion
# ---------------------------------------------------------------------------

def _harvest_to_read(listing) -> HarvestListingRead:
    """Convert HarvestListing ORM row to HarvestListingRead schema.

    Extracts lat/lng from the WKB geography column if populated.
    """
    from app.listings.schemas import CropBrief

    lat = lng = None
    if listing.location is not None:
        try:
            from geoalchemy2.shape import to_shape
            point = to_shape(listing.location)
            lat = point.y
            lng = point.x
        except Exception:
            pass

    crop_brief = None
    if listing.crop:
        crop_brief = CropBrief.model_validate(listing.crop)

    return HarvestListingRead(
        id=listing.id,
        farmer_id=listing.farmer_id,
        crop_id=listing.crop_id,
        crop=crop_brief,
        variety=listing.variety,
        quantity_kg=float(listing.quantity_kg),
        price_per_kg=float(listing.price_per_kg) if listing.price_per_kg is not None else None,
        min_price_per_kg=float(listing.min_price_per_kg) if listing.min_price_per_kg is not None else None,
        quality_grade=listing.quality_grade,
        harvest_date=listing.harvest_date,
        available_from=listing.available_from,
        available_until=listing.available_until,
        latitude=lat,
        longitude=lng,
        description=listing.description,
        images=listing.images,
        status=listing.status.value if hasattr(listing.status, "value") else listing.status,
        is_organic=listing.is_organic,
        delivery_available=listing.delivery_available,
        delivery_radius_km=listing.delivery_radius_km,
        created_at=listing.created_at,
        updated_at=listing.updated_at,
    )


def _demand_to_read(posting) -> DemandPostingRead:
    """Convert DemandPosting ORM row to DemandPostingRead schema."""
    from app.listings.schemas import CropBrief

    lat = lng = None
    if posting.location is not None:
        try:
            from geoalchemy2.shape import to_shape
            point = to_shape(posting.location)
            lat = point.y
            lng = point.x
        except Exception:
            pass

    crop_brief = None
    if posting.crop:
        crop_brief = CropBrief.model_validate(posting.crop)

    return DemandPostingRead(
        id=posting.id,
        buyer_id=posting.buyer_id,
        crop_id=posting.crop_id,
        crop=crop_brief,
        variety=posting.variety,
        quantity_kg=float(posting.quantity_kg),
        max_price_per_kg=float(posting.max_price_per_kg) if posting.max_price_per_kg is not None else None,
        quality_grade=posting.quality_grade,
        needed_by=posting.needed_by,
        latitude=lat,
        longitude=lng,
        radius_km=posting.radius_km,
        description=posting.description,
        status=posting.status.value if hasattr(posting.status, "value") else posting.status,
        is_recurring=posting.is_recurring,
        recurrence_pattern=posting.recurrence_pattern,
        created_at=posting.created_at,
        updated_at=posting.updated_at,
    )
