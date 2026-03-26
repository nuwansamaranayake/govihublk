"""GoviHub Listings Service — CRUD + status transitions for HarvestListing and DemandPosting."""

from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.listings.models import (
    CropTaxonomy,
    DemandPosting,
    DemandStatus,
    HarvestListing,
    HarvestStatus,
)

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Status transition maps
# ---------------------------------------------------------------------------

HARVEST_TRANSITIONS: dict[HarvestStatus, set[HarvestStatus]] = {
    HarvestStatus.planned: {HarvestStatus.ready, HarvestStatus.cancelled},
    HarvestStatus.ready: {HarvestStatus.matched, HarvestStatus.cancelled},
    HarvestStatus.matched: {HarvestStatus.fulfilled, HarvestStatus.cancelled},
    HarvestStatus.fulfilled: set(),
    HarvestStatus.expired: set(),
    HarvestStatus.cancelled: set(),
}

DEMAND_TRANSITIONS: dict[DemandStatus, set[DemandStatus]] = {
    DemandStatus.open: {DemandStatus.reviewing, DemandStatus.cancelled},
    DemandStatus.reviewing: {DemandStatus.confirmed, DemandStatus.open, DemandStatus.cancelled},
    DemandStatus.confirmed: {DemandStatus.fulfilled, DemandStatus.cancelled},
    DemandStatus.fulfilled: {DemandStatus.closed},
    DemandStatus.closed: set(),
    DemandStatus.expired: set(),
    DemandStatus.cancelled: set(),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _geo_point_wkt(lat: float, lng: float) -> str:
    """Return WKT POINT string for PostGIS."""
    return f"SRID=4326;POINT({lng} {lat})"


# ---------------------------------------------------------------------------
# ListingService
# ---------------------------------------------------------------------------

class ListingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # -----------------------------------------------------------------------
    # Harvest Listing
    # -----------------------------------------------------------------------

    async def create_harvest(self, farmer_id: UUID, data: dict) -> HarvestListing:
        """Create a new harvest listing (starts as planned)."""
        lat = data.pop("latitude", None)
        lng = data.pop("longitude", None)

        listing = HarvestListing(farmer_id=farmer_id, **data)
        self.db.add(listing)
        await self.db.flush()  # get the generated id

        if lat is not None and lng is not None:
            await self.db.execute(
                text(
                    "UPDATE harvest_listings "
                    "SET location = ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) "
                    "WHERE id = :id"
                ).bindparams(lng=lng, lat=lat, id=listing.id)
            )
            await self.db.flush()

        await self.db.refresh(listing, attribute_names=["crop"])
        logger.info("harvest_listing_created", listing_id=str(listing.id), farmer_id=str(farmer_id))
        return listing

    async def get_harvest(self, listing_id: UUID) -> HarvestListing:
        """Get a harvest listing with crop info or raise 404."""
        result = await self.db.execute(
            select(HarvestListing)
            .where(HarvestListing.id == listing_id)
            .options(selectinload(HarvestListing.crop))
        )
        listing = result.scalar_one_or_none()
        if not listing:
            raise NotFoundError(detail="Harvest listing not found")
        return listing

    async def list_my_harvests(
        self,
        farmer_id: UUID,
        status: Optional[str],
        crop_id: Optional[UUID],
        page: int,
        size: int,
    ) -> tuple[list[HarvestListing], int]:
        """List harvests belonging to the current farmer."""
        query = (
            select(HarvestListing)
            .where(HarvestListing.farmer_id == farmer_id)
            .options(selectinload(HarvestListing.crop))
            .order_by(HarvestListing.created_at.desc())
        )
        count_query = (
            select(func.count())
            .select_from(HarvestListing)
            .where(HarvestListing.farmer_id == farmer_id)
        )

        if status:
            try:
                status_enum = HarvestStatus(status)
            except ValueError:
                raise ValidationError(detail=f"Invalid status: {status}")
            query = query.where(HarvestListing.status == status_enum)
            count_query = count_query.where(HarvestListing.status == status_enum)

        if crop_id:
            query = query.where(HarvestListing.crop_id == crop_id)
            count_query = count_query.where(HarvestListing.crop_id == crop_id)

        total = (await self.db.execute(count_query)).scalar()
        listings = (
            await self.db.execute(query.offset((page - 1) * size).limit(size))
        ).scalars().all()

        return list(listings), total

    async def list_all_harvests(
        self,
        filters: dict,
        page: int,
        size: int,
    ) -> tuple[list[HarvestListing], int]:
        """List active harvest listings with optional geo/crop/price filters."""
        lat = filters.get("latitude")
        lng = filters.get("longitude")
        radius_km = filters.get("radius_km")
        crop_id = filters.get("crop_id")
        category = filters.get("category")
        is_organic = filters.get("is_organic")
        quality_grade = filters.get("quality_grade")
        min_price = filters.get("min_price")
        max_price = filters.get("max_price")
        available_from = filters.get("available_from")
        available_until = filters.get("available_until")
        status = filters.get("status")

        # Base query — only planned/ready listings by default for browse
        query = (
            select(HarvestListing)
            .options(selectinload(HarvestListing.crop))
            .order_by(HarvestListing.created_at.desc())
        )
        count_query = select(func.count()).select_from(HarvestListing)

        # Status filter
        if status:
            try:
                status_enum = HarvestStatus(status)
            except ValueError:
                raise ValidationError(detail=f"Invalid status: {status}")
            query = query.where(HarvestListing.status == status_enum)
            count_query = count_query.where(HarvestListing.status == status_enum)
        else:
            query = query.where(HarvestListing.status.in_([HarvestStatus.planned, HarvestStatus.ready]))
            count_query = count_query.where(HarvestListing.status.in_([HarvestStatus.planned, HarvestStatus.ready]))

        if crop_id:
            query = query.where(HarvestListing.crop_id == crop_id)
            count_query = count_query.where(HarvestListing.crop_id == crop_id)

        if category:
            query = query.join(
                CropTaxonomy, HarvestListing.crop_id == CropTaxonomy.id
            ).where(CropTaxonomy.category == category)
            count_query = count_query.join(
                CropTaxonomy, HarvestListing.crop_id == CropTaxonomy.id
            ).where(CropTaxonomy.category == category)

        if is_organic is not None:
            query = query.where(HarvestListing.is_organic == is_organic)
            count_query = count_query.where(HarvestListing.is_organic == is_organic)

        if quality_grade:
            query = query.where(HarvestListing.quality_grade == quality_grade)
            count_query = count_query.where(HarvestListing.quality_grade == quality_grade)

        if min_price is not None:
            query = query.where(HarvestListing.price_per_kg >= min_price)
            count_query = count_query.where(HarvestListing.price_per_kg >= min_price)

        if max_price is not None:
            query = query.where(HarvestListing.price_per_kg <= max_price)
            count_query = count_query.where(HarvestListing.price_per_kg <= max_price)

        if available_from:
            query = query.where(
                (HarvestListing.available_until == None) | (HarvestListing.available_until >= available_from)
            )
            count_query = count_query.where(
                (HarvestListing.available_until == None) | (HarvestListing.available_until >= available_from)
            )

        if available_until:
            query = query.where(
                (HarvestListing.available_from == None) | (HarvestListing.available_from <= available_until)
            )
            count_query = count_query.where(
                (HarvestListing.available_from == None) | (HarvestListing.available_from <= available_until)
            )

        # Geo filter using ST_DWithin (radius in meters)
        if lat is not None and lng is not None and radius_km is not None:
            radius_m = radius_km * 1000
            geo_filter = text(
                "ST_DWithin("
                "harvest_listings.location::geography, "
                "ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, "
                ":radius_m"
                ")"
            ).bindparams(lat=lat, lng=lng, radius_m=radius_m)
            query = query.where(geo_filter)
            count_query = count_query.where(geo_filter)

        total = (await self.db.execute(count_query)).scalar()
        listings = (
            await self.db.execute(query.offset((page - 1) * size).limit(size))
        ).scalars().all()

        return list(listings), total

    async def update_harvest(
        self, listing_id: UUID, farmer_id: UUID, data: dict
    ) -> HarvestListing:
        """Update a harvest listing. Only owner can update; only draft/active allowed."""
        listing = await self.get_harvest(listing_id)

        if listing.farmer_id != farmer_id:
            raise ForbiddenError(detail="You do not own this listing")

        if listing.status not in (HarvestStatus.planned, HarvestStatus.ready):
            raise ValidationError(
                detail=f"Cannot update listing in '{listing.status.value}' status"
            )

        lat = data.pop("latitude", None)
        lng = data.pop("longitude", None)

        for key, value in data.items():
            if value is not None and hasattr(listing, key):
                setattr(listing, key, value)

        if lat is not None and lng is not None:
            await self.db.execute(
                text(
                    "UPDATE harvest_listings "
                    "SET location = ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) "
                    "WHERE id = :id"
                ).bindparams(lng=lng, lat=lat, id=listing.id)
            )

        await self.db.flush()
        await self.db.refresh(listing)
        logger.info("harvest_listing_updated", listing_id=str(listing_id))
        return listing

    async def update_harvest_status(
        self, listing_id: UUID, farmer_id: UUID, new_status: str
    ) -> HarvestListing:
        """Transition harvest listing status with validation."""
        listing = await self.get_harvest(listing_id)

        if listing.farmer_id != farmer_id:
            raise ForbiddenError(detail="You do not own this listing")

        try:
            target = HarvestStatus(new_status)
        except ValueError:
            raise ValidationError(detail=f"Invalid status: {new_status}")

        allowed = HARVEST_TRANSITIONS.get(listing.status, set())
        if target not in allowed:
            raise ValidationError(
                detail=(
                    f"Cannot transition from '{listing.status.value}' to '{target.value}'. "
                    f"Allowed transitions: {[s.value for s in allowed]}"
                )
            )

        listing.status = target
        await self.db.flush()
        logger.info(
            "harvest_status_updated",
            listing_id=str(listing_id),
            from_status=listing.status.value if hasattr(listing.status, "value") else listing.status,
            to_status=target.value,
        )
        return listing

    async def delete_harvest(self, listing_id: UUID, farmer_id: UUID) -> None:
        """Delete a harvest listing. Only planned listings can be hard-deleted."""
        listing = await self.get_harvest(listing_id)

        if listing.farmer_id != farmer_id:
            raise ForbiddenError(detail="You do not own this listing")

        if listing.status != HarvestStatus.planned:
            # Soft cancel instead of hard delete
            raise ValidationError(
                detail=(
                    "Only planned listings can be deleted. "
                    "Cancel this listing by updating its status to 'cancelled'."
                )
            )

        await self.db.delete(listing)
        await self.db.flush()
        logger.info("harvest_listing_deleted", listing_id=str(listing_id))

    # -----------------------------------------------------------------------
    # Demand Posting
    # -----------------------------------------------------------------------

    async def create_demand(self, buyer_id: UUID, data: dict) -> DemandPosting:
        """Create a new demand posting."""
        lat = data.pop("latitude", None)
        lng = data.pop("longitude", None)

        posting = DemandPosting(buyer_id=buyer_id, **data)
        self.db.add(posting)
        await self.db.flush()

        if lat is not None and lng is not None:
            await self.db.execute(
                text(
                    "UPDATE demand_postings "
                    "SET location = ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) "
                    "WHERE id = :id"
                ).bindparams(lng=lng, lat=lat, id=posting.id)
            )
            await self.db.flush()

        await self.db.refresh(posting, attribute_names=["crop"])
        logger.info("demand_posting_created", posting_id=str(posting.id), buyer_id=str(buyer_id))
        return posting

    async def get_demand(self, posting_id: UUID) -> DemandPosting:
        """Get a demand posting with crop info or raise 404."""
        result = await self.db.execute(
            select(DemandPosting)
            .where(DemandPosting.id == posting_id)
            .options(selectinload(DemandPosting.crop))
        )
        posting = result.scalar_one_or_none()
        if not posting:
            raise NotFoundError(detail="Demand posting not found")
        return posting

    async def list_my_demands(
        self,
        buyer_id: UUID,
        status: Optional[str],
        crop_id: Optional[UUID],
        page: int,
        size: int,
    ) -> tuple[list[DemandPosting], int]:
        """List demand postings belonging to the current buyer."""
        query = (
            select(DemandPosting)
            .where(DemandPosting.buyer_id == buyer_id)
            .options(selectinload(DemandPosting.crop))
            .order_by(DemandPosting.created_at.desc())
        )
        count_query = (
            select(func.count())
            .select_from(DemandPosting)
            .where(DemandPosting.buyer_id == buyer_id)
        )

        if status:
            try:
                status_enum = DemandStatus(status)
            except ValueError:
                raise ValidationError(detail=f"Invalid status: {status}")
            query = query.where(DemandPosting.status == status_enum)
            count_query = count_query.where(DemandPosting.status == status_enum)

        if crop_id:
            query = query.where(DemandPosting.crop_id == crop_id)
            count_query = count_query.where(DemandPosting.crop_id == crop_id)

        total = (await self.db.execute(count_query)).scalar()
        postings = (
            await self.db.execute(query.offset((page - 1) * size).limit(size))
        ).scalars().all()

        return list(postings), total

    async def list_all_demands(
        self,
        filters: dict,
        page: int,
        size: int,
    ) -> tuple[list[DemandPosting], int]:
        """List demand postings with optional geo/crop/price filters."""
        lat = filters.get("latitude")
        lng = filters.get("longitude")
        radius_km = filters.get("radius_km")
        crop_id = filters.get("crop_id")
        category = filters.get("category")
        quality_grade = filters.get("quality_grade")
        max_price = filters.get("max_price")
        needed_by_before = filters.get("needed_by_before")
        status = filters.get("status")

        query = (
            select(DemandPosting)
            .options(selectinload(DemandPosting.crop))
            .order_by(DemandPosting.created_at.desc())
        )
        count_query = select(func.count()).select_from(DemandPosting)

        if status:
            try:
                status_enum = DemandStatus(status)
            except ValueError:
                raise ValidationError(detail=f"Invalid status: {status}")
            query = query.where(DemandPosting.status == status_enum)
            count_query = count_query.where(DemandPosting.status == status_enum)
        else:
            query = query.where(DemandPosting.status.in_([DemandStatus.open, DemandStatus.reviewing]))
            count_query = count_query.where(DemandPosting.status.in_([DemandStatus.open, DemandStatus.reviewing]))

        if crop_id:
            query = query.where(DemandPosting.crop_id == crop_id)
            count_query = count_query.where(DemandPosting.crop_id == crop_id)

        if category:
            query = query.join(
                CropTaxonomy, DemandPosting.crop_id == CropTaxonomy.id
            ).where(CropTaxonomy.category == category)
            count_query = count_query.join(
                CropTaxonomy, DemandPosting.crop_id == CropTaxonomy.id
            ).where(CropTaxonomy.category == category)

        if quality_grade:
            query = query.where(DemandPosting.quality_grade == quality_grade)
            count_query = count_query.where(DemandPosting.quality_grade == quality_grade)

        if max_price is not None:
            query = query.where(DemandPosting.max_price_per_kg <= max_price)
            count_query = count_query.where(DemandPosting.max_price_per_kg <= max_price)

        if needed_by_before:
            query = query.where(
                (DemandPosting.needed_by == None) | (DemandPosting.needed_by <= needed_by_before)
            )
            count_query = count_query.where(
                (DemandPosting.needed_by == None) | (DemandPosting.needed_by <= needed_by_before)
            )

        # Geo filter using ST_DWithin (radius in meters)
        if lat is not None and lng is not None and radius_km is not None:
            radius_m = radius_km * 1000
            geo_filter = text(
                "ST_DWithin("
                "demand_postings.location::geography, "
                "ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, "
                ":radius_m"
                ")"
            ).bindparams(lat=lat, lng=lng, radius_m=radius_m)
            query = query.where(geo_filter)
            count_query = count_query.where(geo_filter)

        total = (await self.db.execute(count_query)).scalar()
        postings = (
            await self.db.execute(query.offset((page - 1) * size).limit(size))
        ).scalars().all()

        return list(postings), total

    async def update_demand(
        self, posting_id: UUID, buyer_id: UUID, data: dict
    ) -> DemandPosting:
        """Update a demand posting."""
        posting = await self.get_demand(posting_id)

        if posting.buyer_id != buyer_id:
            raise ForbiddenError(detail="You do not own this demand posting")

        if posting.status not in (DemandStatus.open, DemandStatus.reviewing):
            raise ValidationError(
                detail=f"Cannot update demand posting in '{posting.status.value}' status"
            )

        lat = data.pop("latitude", None)
        lng = data.pop("longitude", None)

        for key, value in data.items():
            if value is not None and hasattr(posting, key):
                setattr(posting, key, value)

        if lat is not None and lng is not None:
            await self.db.execute(
                text(
                    "UPDATE demand_postings "
                    "SET location = ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) "
                    "WHERE id = :id"
                ).bindparams(lng=lng, lat=lat, id=posting.id)
            )

        await self.db.flush()
        await self.db.refresh(posting)
        logger.info("demand_posting_updated", posting_id=str(posting_id))
        return posting

    async def update_demand_status(
        self, posting_id: UUID, buyer_id: UUID, new_status: str
    ) -> DemandPosting:
        """Transition demand posting status with validation."""
        posting = await self.get_demand(posting_id)

        if posting.buyer_id != buyer_id:
            raise ForbiddenError(detail="You do not own this demand posting")

        try:
            target = DemandStatus(new_status)
        except ValueError:
            raise ValidationError(detail=f"Invalid status: {new_status}")

        allowed = DEMAND_TRANSITIONS.get(posting.status, set())
        if target not in allowed:
            raise ValidationError(
                detail=(
                    f"Cannot transition from '{posting.status.value}' to '{target.value}'. "
                    f"Allowed transitions: {[s.value for s in allowed]}"
                )
            )

        posting.status = target
        await self.db.flush()
        logger.info(
            "demand_status_updated",
            posting_id=str(posting_id),
            to_status=target.value,
        )
        return posting

    async def delete_demand(self, posting_id: UUID, buyer_id: UUID) -> None:
        """Delete a demand posting. Only open postings can be hard-deleted."""
        posting = await self.get_demand(posting_id)

        if posting.buyer_id != buyer_id:
            raise ForbiddenError(detail="You do not own this demand posting")

        if posting.status != DemandStatus.open:
            raise ValidationError(
                detail=(
                    "Only open postings can be deleted. "
                    "Cancel this posting by updating its status to 'cancelled'."
                )
            )

        await self.db.delete(posting)
        await self.db.flush()
        logger.info("demand_posting_deleted", posting_id=str(posting_id))
