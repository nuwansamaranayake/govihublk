"""GoviHub Marketplace Model — SupplyListing."""

import enum
from datetime import date
from typing import Optional

from geoalchemy2 import Geography
from sqlalchemy import Boolean, Date, Enum, Float, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SupplyCategory(str, enum.Enum):
    seeds = "seeds"
    fertilizer = "fertilizer"
    pesticide = "pesticide"
    equipment = "equipment"
    tools = "tools"
    irrigation = "irrigation"
    other = "other"


class SupplyStatus(str, enum.Enum):
    active = "active"
    out_of_stock = "out_of_stock"
    discontinued = "discontinued"


class SupplyListing(Base):
    __tablename__ = "supply_listings"

    supplier_id: Mapped["UUID"] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_si: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[SupplyCategory] = mapped_column(
        Enum(SupplyCategory, name="supply_category", create_constraint=True),
        nullable=False, index=True,
    )
    price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    stock_quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    images: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(Geography("POINT", srid=4326), nullable=True)
    delivery_available: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    delivery_radius_km: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[SupplyStatus] = mapped_column(
        Enum(SupplyStatus, name="supply_status", create_constraint=True),
        default=SupplyStatus.active,
        server_default="active",
    )

    supplier: Mapped["app.users.models.User"] = relationship(foreign_keys=[supplier_id])

    __table_args__ = (
        Index("ix_supply_listings_location", "location", postgresql_using="gist"),
        Index("ix_supply_listings_category_status", "category", "status"),
    )
