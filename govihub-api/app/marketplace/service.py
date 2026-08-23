"""GoviHub Marketplace Service — CRUD for SupplyListing with PostGIS proximity search."""

from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy import func, select, text, cast, Float
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.marketplace.models import SupplyCategory, SupplyListing, SupplyStatus
from app.marketplace.schemas import SupplyListingCreate, SupplyListingUpdate, SupplySearchFilter
from app.users.models import User

logger = structlog.get_logger()


def _geo_point_wkt(lat: float, lng: float) -> str:
    """Return WKT POINT string for PostGIS."""
    return f"SRID=4326;POINT({lng} {lat})"


class SupplyMarketplaceService:
    """Service layer for supply marketplace operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # -----------------------------------------------------------------------
    # Create
    # -----------------------------------------------------------------------

    async def create_listing(self, supplier_id: UUID, data: SupplyListingCreate) -> SupplyListing:
        """Create a new supply listing. Only supplier role users may call this."""
        payload = data.model_dump(exclude_none=True)

        lat = payload.pop("latitude", None)
        lng = payload.pop("longitude", None)
        photos = payload.pop("photos", None)

        listing = SupplyListing(
            supplier_id=supplier_id,
            **payload,
        )

        if lat is not None and lng is not None:
            listing.location = _geo_point_wkt(lat, lng)

        if photos is not None:
            listing.images = {"urls": photos}

        self.db.add(listing)
        await self.db.flush()
        await self.db.refresh(listing)

        logger.info("supply_listing_created", listing_id=str(listing.id), supplier_id=str(supplier_id))
        return listing

    # -----------------------------------------------------------------------
    # Update
    # -----------------------------------------------------------------------

    async def update_listing(
        self, listing_id: UUID, supplier_id: UUID, data: SupplyListingUpdate
    ) -> SupplyListing:
        """Update a supply listing. Only the owning supplier may update."""
        listing = await self._get_or_404(listing_id)

        if listing.supplier_id != supplier_id:
            raise ForbiddenError(detail="You do not own this listing")

        payload = data.model_dump(exclude_unset=True)

        lat = payload.pop("latitude", None)
        lng = payload.pop("longitude", None)
        photos = payload.pop("photos", None)

        for field, value in payload.items():
            setattr(listing, field, value)

        if lat is not None and lng is not None:
            listing.location = _geo_point_wkt(lat, lng)

        if photos is not None:
            listing.images = {"urls": photos}

        await self.db.flush()
        await self.db.refresh(listing)

        logger.info("supply_listing_updated", listing_id=str(listing_id))
        return listing

    # -----------------------------------------------------------------------
    # Delete
    # -----------------------------------------------------------------------

    async def delete_listing(self, listing_id: UUID, supplier_id: UUID) -> None:
        """Soft-delete by marking discontinued. Only the owning supplier may delete."""
        listing = await self._get_or_404(listing_id)

        if listing.supplier_id != supplier_id:
            raise ForbiddenError(detail="You do not own this listing")

        listing.status = SupplyStatus.discontinued
        await self.db.flush()
        logger.info("supply_listing_deleted", listing_id=str(listing_id))

    # -----------------------------------------------------------------------
    # List my listings
    # -----------------------------------------------------------------------

    async def list_my_listings(
        self,
        supplier_id: UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[int, list[SupplyListing]]:
        """Return all listings belonging to the given supplier."""
        base_q = (
            select(SupplyListing)
            .where(SupplyListing.supplier_id == supplier_id)
            .where(SupplyListing.status != SupplyStatus.discontinued)
        )

        count_q = select(func.count()).select_from(base_q.subquery())
        total_result = await self.db.execute(count_q)
        total = total_result.scalar_one()

        offset = (page - 1) * page_size
        items_q = base_q.order_by(SupplyListing.created_at.desc()).offset(offset).limit(page_size)
        result = await self.db.execute(items_q)
        listings = list(result.scalars().all())

        return total, listings

    # -----------------------------------------------------------------------
    # Search listings
    # -----------------------------------------------------------------------

    async def search_listings(
        self, filters: SupplySearchFilter
    ) -> tuple[int, list[dict]]:
        """
        Search supply listings with optional:
        - PostGIS ST_Distance proximity filter
        - ILIKE keyword on name/description
        - Category filter
        - Price range filter
        - Delivery filter
        """
        # Build base conditions list — exclude listings from deactivated suppliers
        conditions = [
            SupplyListing.status == filters.status,
            SupplyListing.supplier_id.in_(
                select(User.id).where(User.is_active.is_(True))
            ),
        ]

        if filters.category:
            conditions.append(SupplyListing.category == filters.category)

        if filters.min_price is not None:
            conditions.append(SupplyListing.price >= filters.min_price)

        if filters.max_price is not None:
            conditions.append(SupplyListing.price <= filters.max_price)

        if filters.delivery_only:
            conditions.append(SupplyListing.delivery_available.is_(True))

        if filters.keyword:
            kw = f"%{filters.keyword}%"
            conditions.append(
                SupplyListing.name.ilike(kw) | SupplyListing.description.ilike(kw)
            )

        # Proximity filter and distance column
        if filters.latitude is not None and filters.longitude is not None:
            origin_wkt = f"SRID=4326;POINT({filters.longitude} {filters.latitude})"
            radius_m = filters.radius_km * 1000

            distance_expr = func.ST_Distance(
                SupplyListing.location,
                text(f"ST_GeographyFromText('{origin_wkt}')"),
            )

            conditions.append(
                func.ST_DWithin(
                    SupplyListing.location,
                    text(f"ST_GeographyFromText('{origin_wkt}')"),
                    radius_m,
                )
            )
            conditions.append(SupplyListing.location.isnot(None))

            base_q = (
                select(
                    SupplyListing,
                    (distance_expr / 1000.0).label("distance_km"),
                )
                .where(*conditions)
                .order_by(distance_expr)
            )
        else:
            base_q = (
                select(SupplyListing)
                .where(*conditions)
                .order_by(SupplyListing.created_at.desc())
            )

        # Count
        count_q = select(func.count()).select_from(
            select(SupplyListing).where(*conditions).subquery()
        )
        total_result = await self.db.execute(count_q)
        total = total_result.scalar_one()

        # Paginate
        offset = (filters.page - 1) * filters.page_size
        paginated_q = base_q.offset(offset).limit(filters.page_size)
        result = await self.db.execute(paginated_q)

        rows = result.all()

        # Build result dicts with optional distance
        items = []
        has_distance = filters.latitude is not None and filters.longitude is not None
        for row in rows:
            if has_distance:
                # proximity query — row is (SupplyListing, distance_km)
                listing_obj = row[0]
                distance_km = row[1] if len(row) > 1 else None
                d = _listing_to_dict(listing_obj)
                d["distance_km"] = round(float(distance_km), 3) if distance_km else None
            else:
                # No proximity — row wraps a single SupplyListing
                listing_obj = row[0] if hasattr(row, "__getitem__") else row
                d = _listing_to_dict(listing_obj)
            items.append(d)

        return total, items

    # -----------------------------------------------------------------------
    # Get by ID
    # -----------------------------------------------------------------------

    async def get_listing(self, listing_id: UUID) -> SupplyListing:
        """Fetch a single listing by ID (raises 404 if not found or discontinued)."""
        listing = await self._get_or_404(listing_id)
        if listing.status == SupplyStatus.discontinued:
            raise NotFoundError(detail="Listing not found")
        return listing

    async def get_listing_with_supplier(self, listing_id: UUID) -> tuple[SupplyListing, Optional[User]]:
        """Fetch a listing plus its supplier row for the detail response."""
        listing = await self.get_listing(listing_id)
        result = await self.db.execute(select(User).where(User.id == listing.supplier_id))
        return listing, result.scalar_one_or_none()

    # -----------------------------------------------------------------------
    # Supplier names for list/search responses (no phone — detail only)
    # -----------------------------------------------------------------------

    async def supplier_names_for(self, supplier_ids: list[UUID]) -> dict[UUID, tuple[str, Optional[str]]]:
        """Batch-fetch (name, district) for a page of listings in one query."""
        if not supplier_ids:
            return {}
        result = await self.db.execute(
            select(User.id, User.name, User.district).where(User.id.in_(set(supplier_ids)))
        )
        return {row.id: (row.name, row.district) for row in result.all()}

    # -----------------------------------------------------------------------
    # Listing images (owner-scoped; rules per CC_INTL_PHONE_SUPPLIER_FIX)
    # -----------------------------------------------------------------------

    MAX_PHOTOS = 3
    MAX_PHOTO_BYTES = 5 * 1024 * 1024
    ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}

    def _require_owner_or_admin(self, listing: SupplyListing, user) -> None:
        from app.users.models import UserRole

        if listing.supplier_id != user.id and user.role != UserRole.admin:
            raise ForbiddenError(detail="You do not own this listing")

    @staticmethod
    def _photo_urls(listing: SupplyListing) -> list[str]:
        raw = listing.images
        if isinstance(raw, dict) and isinstance(raw.get("urls"), list):
            return [u for u in raw["urls"] if isinstance(u, str)]
        if isinstance(raw, list):
            return [u for u in raw if isinstance(u, str)]
        return []

    async def add_listing_images(
        self, listing_id: UUID, user, files: list[tuple[bytes, str]]
    ) -> list[str]:
        """Validate and upload 1-3 images for a listing. Returns the full photo list."""
        from app.exceptions import GoviHubException
        from app.utils.storage import storage_service

        listing = await self._get_or_404(listing_id)
        self._require_owner_or_admin(listing, user)

        existing = self._photo_urls(listing)
        if len(existing) + len(files) > self.MAX_PHOTOS:
            raise GoviHubException(
                status_code=400,
                detail=f"A listing can have at most {self.MAX_PHOTOS} photos",
                error_code="LISTING_PHOTO_LIMIT",
                details={"current": len(existing), "adding": len(files), "max": self.MAX_PHOTOS},
            )

        for file_bytes, content_type in files:
            normalised = (content_type or "").lower().split(";")[0].strip()
            if normalised not in self.ALLOWED_PHOTO_TYPES:
                raise ValidationError(
                    detail=f"Unsupported file type '{content_type}'. Only JPEG, PNG, and WebP are accepted.",
                    details={"allowed": sorted(self.ALLOWED_PHOTO_TYPES)},
                )
            if len(file_bytes) > self.MAX_PHOTO_BYTES:
                raise ValidationError(
                    detail=f"File too large ({len(file_bytes):,} bytes). Maximum is 5 MB per photo.",
                    details={"max_bytes": self.MAX_PHOTO_BYTES},
                )

        urls = list(existing)
        for file_bytes, content_type in files:
            url = await storage_service.upload_image(
                file_bytes, content_type, folder=f"marketplace/{listing_id}"
            )
            urls.append(url)

        # Reassign (never mutate in place) so SQLAlchemy detects the JSONB change.
        listing.images = {"urls": urls}
        await self.db.flush()
        logger.info("supply_listing_images_added", listing_id=str(listing_id), count=len(files))
        return urls

    async def remove_listing_image(self, listing_id: UUID, user, url: str) -> list[str]:
        """Remove one image URL from a listing. R2 delete is best-effort."""
        from app.utils.storage import storage_service

        listing = await self._get_or_404(listing_id)
        self._require_owner_or_admin(listing, user)

        existing = self._photo_urls(listing)
        if url not in existing:
            raise NotFoundError(detail="Photo not found on this listing")

        urls = [u for u in existing if u != url]
        listing.images = {"urls": urls}
        await self.db.flush()

        try:
            await storage_service.delete_image(url)
        except Exception as exc:  # noqa: BLE001 — best-effort by spec; the DB row is the source of truth
            logger.warning("supply_listing_image_r2_delete_failed", url=url, error=str(exc))

        logger.info("supply_listing_image_removed", listing_id=str(listing_id))
        return urls

    # -----------------------------------------------------------------------
    # Internal helpers
    # -----------------------------------------------------------------------

    async def _get_or_404(self, listing_id: UUID) -> SupplyListing:
        result = await self.db.execute(
            select(SupplyListing).where(SupplyListing.id == listing_id)
        )
        listing = result.scalar_one_or_none()
        if not listing:
            raise NotFoundError(detail=f"Supply listing {listing_id} not found")
        return listing


def _listing_to_dict(listing: SupplyListing) -> dict:
    """Convert a SupplyListing ORM object to a plain dict, extracting lat/lng."""
    from geoalchemy2.shape import to_shape

    lat = None
    lng = None
    if listing.location is not None:
        try:
            point = to_shape(listing.location)
            lat = point.y
            lng = point.x
        except Exception:
            pass

    return {
        "id": listing.id,
        "supplier_id": listing.supplier_id,
        "category": listing.category,
        "name": listing.name,
        "name_si": listing.name_si,
        "description": listing.description,
        "price": float(listing.price) if listing.price is not None else None,
        "unit": listing.unit,
        "stock_quantity": listing.stock_quantity,
        "images": listing.images,
        "latitude": lat,
        "longitude": lng,
        "delivery_available": listing.delivery_available,
        "delivery_radius_km": listing.delivery_radius_km,
        "status": listing.status,
        "distance_km": None,
        "created_at": listing.created_at,
        "updated_at": listing.updated_at,
    }
