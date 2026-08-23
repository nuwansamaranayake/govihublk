"""GoviHub Marketplace Router — Supply Listing endpoints."""

from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, File, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_complete_profile, require_role
from app.marketplace.models import SupplyCategory, SupplyStatus
from app.marketplace.schemas import (
    SupplierBrief,
    SupplyListingCreate,
    SupplyListingDetail,
    SupplyListingPage,
    SupplyListingRead,
    SupplyListingUpdate,
    SupplySearchFilter,
)
from app.marketplace.service import SupplyMarketplaceService, _listing_to_dict

logger = structlog.get_logger()

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper: build SupplyListingRead from ORM object
# ---------------------------------------------------------------------------

def _orm_to_read(listing) -> SupplyListingRead:
    """Convert ORM object to SupplyListingRead, extracting geo coords."""
    d = _listing_to_dict(listing)
    return SupplyListingRead(**d)


async def _page_with_supplier_names(
    svc: SupplyMarketplaceService, items: list[dict]
) -> list[SupplyListingRead]:
    """Attach supplier_name/supplier_district to a page of result dicts.

    One batch query per page. Phone is deliberately NOT included here — the
    list surface never carries it (bulk-scrape control); only the detail does.
    """
    names = await svc.supplier_names_for([d["supplier_id"] for d in items])
    results = []
    for d in items:
        name_district = names.get(d["supplier_id"])
        if name_district:
            d["supplier_name"], d["supplier_district"] = name_district
        results.append(SupplyListingRead(**d))
    return results


# ---------------------------------------------------------------------------
# GET /categories
# ---------------------------------------------------------------------------

@router.get("/categories", summary="List all supply categories")
async def list_categories():
    """Return all available supply categories."""
    return {
        "categories": [
            {"value": c.value, "label": c.value.replace("_", " ").title()}
            for c in SupplyCategory
        ]
    }


# ---------------------------------------------------------------------------
# POST /listings
# ---------------------------------------------------------------------------

@router.post("/listings", response_model=SupplyListingRead, status_code=201, summary="Create supply listing")
async def create_listing(
    data: SupplyListingCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("supplier", "admin")),
):
    """Create a new supply listing. Requires supplier or admin role."""
    svc = SupplyMarketplaceService(db)
    listing = await svc.create_listing(supplier_id=current_user.id, data=data)
    return _orm_to_read(listing)


# ---------------------------------------------------------------------------
# GET /listings  (my listings)
# ---------------------------------------------------------------------------

@router.get("/listings/mine", response_model=SupplyListingPage, summary="Get my supply listings")
async def list_my_listings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("supplier", "admin")),
):
    """Return all active listings belonging to the authenticated supplier."""
    svc = SupplyMarketplaceService(db)
    total, listings = await svc.list_my_listings(
        supplier_id=current_user.id, page=page, page_size=page_size
    )
    return SupplyListingPage(
        total=total,
        page=page,
        page_size=page_size,
        results=[_orm_to_read(l) for l in listings],
    )


# ---------------------------------------------------------------------------
# GET /search
# ---------------------------------------------------------------------------

@router.get("/search", response_model=SupplyListingPage, summary="Search supply listings")
async def search_listings(
    keyword: Optional[str] = Query(None, description="Keyword search"),
    category: Optional[SupplyCategory] = Query(None),
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
    radius_km: float = Query(50.0, gt=0, le=500),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    delivery_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _current_user=Depends(require_complete_profile),
):
    """
    Search supply listings with optional keyword, category, proximity, and price filters.
    Results are ordered by proximity when lat/lng are provided.
    """
    filters = SupplySearchFilter(
        keyword=keyword,
        category=category,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        min_price=min_price,
        max_price=max_price,
        delivery_only=delivery_only,
        page=page,
        page_size=page_size,
    )

    svc = SupplyMarketplaceService(db)
    total, items = await svc.search_listings(filters)

    results = await _page_with_supplier_names(svc, items)
    return SupplyListingPage(total=total, page=page, page_size=page_size, results=results)


# ---------------------------------------------------------------------------
# GET /listings/{id}
# ---------------------------------------------------------------------------

@router.get("/listings/{listing_id}", response_model=SupplyListingDetail, summary="Get supply listing by ID")
async def get_listing(
    listing_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user=Depends(require_complete_profile),
):
    """Retrieve a single supply listing with its supplier contact block.

    This is the only marketplace surface that exposes the supplier's phone,
    and it sits behind auth — the list responses never carry it.
    """
    svc = SupplyMarketplaceService(db)
    listing, supplier = await svc.get_listing_with_supplier(listing_id)
    detail = SupplyListingDetail(**_listing_to_dict(listing))
    if supplier is not None:
        detail.supplier = SupplierBrief(
            id=supplier.id,
            name=supplier.name,
            phone=supplier.phone,
            district=supplier.district,
            member_since=supplier.created_at,
        )
        detail.supplier_name = supplier.name
        detail.supplier_district = supplier.district
    return detail


# ---------------------------------------------------------------------------
# PUT /listings/{id}
# ---------------------------------------------------------------------------

@router.put("/listings/{listing_id}", response_model=SupplyListingRead, summary="Update supply listing")
async def update_listing(
    listing_id: UUID,
    data: SupplyListingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("supplier", "admin")),
):
    """Update an existing supply listing. Only the owning supplier may update."""
    svc = SupplyMarketplaceService(db)
    listing = await svc.update_listing(
        listing_id=listing_id, supplier_id=current_user.id, data=data
    )
    return _orm_to_read(listing)


# ---------------------------------------------------------------------------
# DELETE /listings/{id}
# ---------------------------------------------------------------------------

@router.delete("/listings/{listing_id}", status_code=204, summary="Delete supply listing")
async def delete_listing(
    listing_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("supplier", "admin")),
):
    """Soft-delete a supply listing (marks as discontinued). Only the owning supplier may delete."""
    svc = SupplyMarketplaceService(db)
    await svc.delete_listing(listing_id=listing_id, supplier_id=current_user.id)
    return None


# ---------------------------------------------------------------------------
# GET /listings  (public browse — no auth required for listing search)
# ---------------------------------------------------------------------------

@router.get("/listings", response_model=SupplyListingPage, summary="Browse supply listings")
async def list_listings(
    category: Optional[SupplyCategory] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _current_user=Depends(require_complete_profile),
):
    """Browse active supply listings, optionally filtered by category."""
    filters = SupplySearchFilter(
        category=category,
        page=page,
        page_size=page_size,
    )
    svc = SupplyMarketplaceService(db)
    total, items = await svc.search_listings(filters)
    results = await _page_with_supplier_names(svc, items)
    return SupplyListingPage(total=total, page=page, page_size=page_size, results=results)


# ---------------------------------------------------------------------------
# Listing images — owner or admin only (see CC_INTL_PHONE_SUPPLIER_FIX)
# ---------------------------------------------------------------------------

class ImageDeleteRequest(BaseModel):
    url: str


@router.post("/listings/{listing_id}/images", summary="Upload listing photos (owner/admin)")
async def upload_listing_images(
    listing_id: UUID,
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("supplier", "admin")),
):
    """Upload 1-3 photos for a listing. JPEG/PNG/WebP, max 5MB each, 3 per listing."""
    svc = SupplyMarketplaceService(db)
    payload = [(await f.read(), f.content_type or "") for f in files]
    urls = await svc.add_listing_images(listing_id, current_user, payload)
    return {"photos": urls}


@router.delete("/listings/{listing_id}/images", summary="Remove a listing photo (owner/admin)")
async def delete_listing_image(
    listing_id: UUID,
    body: ImageDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("supplier", "admin")),
):
    """Remove one photo URL from a listing. The R2 object delete is best-effort."""
    svc = SupplyMarketplaceService(db)
    urls = await svc.remove_listing_image(listing_id, current_user, body.url)
    return {"photos": urls}
