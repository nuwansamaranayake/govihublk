"""GoviHub Listings Models — CropTaxonomy, HarvestListing, DemandPosting."""

import enum
from datetime import date, datetime
from typing import Optional

from geoalchemy2 import Geography
from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, Enum, Float, ForeignKey,
    Index, Integer, Numeric, String, Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CropCategory(str, enum.Enum):
    vegetable = "vegetable"
    fruit = "fruit"
    grain = "grain"
    pulse = "pulse"
    spice = "spice"


class HarvestStatus(str, enum.Enum):
    planned = "planned"
    ready = "ready"
    matched = "matched"
    fulfilled = "fulfilled"
    expired = "expired"
    cancelled = "cancelled"


class DemandStatus(str, enum.Enum):
    open = "open"
    reviewing = "reviewing"
    confirmed = "confirmed"
    fulfilled = "fulfilled"
    closed = "closed"
    expired = "expired"
    cancelled = "cancelled"


class CropTaxonomy(Base):
    __tablename__ = "crop_taxonomy"

    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name_en: Mapped[str] = mapped_column(String(100), nullable=False)
    name_si: Mapped[str] = mapped_column(String(100), nullable=False)
    name_ta: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    category: Mapped[CropCategory] = mapped_column(
        Enum(CropCategory, name="crop_category", create_constraint=True),
        nullable=False,
    )
    season: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    avg_yield_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class HarvestListing(Base):
    __tablename__ = "harvest_listings"

    farmer_id: Mapped["UUID"] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    crop_id: Mapped["UUID"] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crop_taxonomy.id"), nullable=False, index=True
    )
    variety: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    quantity_kg: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    price_per_kg: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    min_price_per_kg: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    quality_grade: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    harvest_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    available_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    available_until: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(Geography("POINT", srid=4326), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    images: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    status: Mapped[HarvestStatus] = mapped_column(
        Enum(HarvestStatus, name="harvest_status", create_constraint=True),
        default=HarvestStatus.planned,
        server_default="planned",
        index=True,
    )
    is_organic: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    delivery_available: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    delivery_radius_km: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sector: Mapped[Optional[str]] = mapped_column(String(50), default="general", server_default="general", index=True)

    # Relationships
    farmer: Mapped["app.users.models.User"] = relationship(foreign_keys=[farmer_id])
    crop: Mapped["CropTaxonomy"] = relationship(foreign_keys=[crop_id])

    __table_args__ = (
        CheckConstraint(
            "status IN ('planned', 'ready', 'matched', 'fulfilled', 'expired', 'cancelled')",
            name="harvest_listing_status_check",
        ),
        Index("ix_harvest_listings_crop_status", "crop_id", "status"),
        Index("ix_harvest_listings_farmer_status", "farmer_id", "status"),
    )


class DemandPosting(Base):
    __tablename__ = "demand_postings"

    buyer_id: Mapped["UUID"] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    crop_id: Mapped["UUID"] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crop_taxonomy.id"), nullable=False, index=True
    )
    variety: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    quantity_kg: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    max_price_per_kg: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    quality_grade: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    needed_by: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(Geography("POINT", srid=4326), nullable=True)
    radius_km: Mapped[int] = mapped_column(Integer, default=50, server_default="50")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[DemandStatus] = mapped_column(
        Enum(DemandStatus, name="demand_status", create_constraint=True),
        default=DemandStatus.open,
        server_default="open",
        index=True,
    )
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    recurrence_pattern: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    sector: Mapped[Optional[str]] = mapped_column(String(50), default="general", server_default="general", index=True)

    # Relationships
    buyer: Mapped["app.users.models.User"] = relationship(foreign_keys=[buyer_id])
    crop: Mapped["CropTaxonomy"] = relationship(foreign_keys=[crop_id])

    __table_args__ = (
        CheckConstraint(
            "status IN ('open', 'reviewing', 'confirmed', 'fulfilled', 'closed', 'expired', 'cancelled')",
            name="demand_posting_status_check",
        ),
        Index("ix_demand_postings_crop_status", "crop_id", "status"),
        Index("ix_demand_postings_buyer_status", "buyer_id", "status"),
    )
