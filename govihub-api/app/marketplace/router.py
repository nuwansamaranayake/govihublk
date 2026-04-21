"""GoviHub Marketplace Router — Supply Listing endpoints."""

from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_complete_profile, require_role
from app.marketplace.models import SupplyCategory, SupplyStatus
from app.marketplace.schemas import (
    SupplyListingCreate,
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

    results = [SupplyListingRead(**item) for item in items]
    return SupplyListingPage(total=total, page=page, page_size=page_size, results=results)


# ---------------------------------------------------------------------------
# GET /listings/{id}
# ---------------------------------------------------------------------------

@router.get("/listings/{listing_id}", response_model=SupplyListingRead, summary="Get supply listing by ID")
async def get_listing(
    listing_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user=Depends(require_complete_profile),
):
    """Retrieve a single supply listing by its UUID."""
    svc = SupplyMarketplaceService(db)
    listing = await svc.get_listing(listing_id)
    return _orm_to_read(listing)


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
    results = [SupplyListingRead(**item) for item in items]
    return SupplyListingPage(total=total, page=page, page_size=page_size, results=results)
