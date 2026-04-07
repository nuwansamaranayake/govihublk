"""GoviHub User Models — User, FarmerProfile, BuyerProfile, SupplierProfile."""

import enum
from datetime import datetime, time, timezone
from typing import Optional

from geoalchemy2 import Geography
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, String, Text, Float, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    farmer = "farmer"
    buyer = "buyer"
    supplier = "supplier"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    username: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    auth_provider: Mapped[Optional[str]] = mapped_column(String(20), default="beta", server_default="beta")
    phone: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", create_constraint=True),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    language: Mapped[str] = mapped_column(String(5), default="si", server_default="si")
    location: Mapped[Optional[str]] = mapped_column(Geography("POINT", srid=4326), nullable=True)
    gn_division: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ds_division: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    district: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    province: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    sector: Mapped[Optional[str]] = mapped_column(String(50), default="general", server_default="general", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    farmer_profile: Mapped[Optional["FarmerProfile"]] = relationship(
        back_populates="user", uselist=False, lazy="selectin"
    )
    buyer_profile: Mapped[Optional["BuyerProfile"]] = relationship(
        back_populates="user", uselist=False, lazy="selectin"
    )
    supplier_profile: Mapped[Optional["SupplierProfile"]] = relationship(
        back_populates="user", uselist=False, lazy="selectin"
    )
    google_account: Mapped[Optional["app.auth.models.GoogleAccount"]] = relationship(
        back_populates="user", uselist=False, lazy="selectin"
    )

    __table_args__ = (
        Index("ix_users_role", "role"),
        Index("ix_users_district", "district"),
    )


class FarmerProfile(Base):
    __tablename__ = "farmer_profiles"

    user_id: Mapped["UUID"] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    farm_size_acres: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    primary_crops: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    irrigation_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    cooperative: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    user: Mapped["User"] = relationship(back_populates="farmer_profile")


class BuyerProfile(Base):
    __tablename__ = "buyer_profiles"

    user_id: Mapped["UUID"] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    business_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    business_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    preferred_districts: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    preferred_radius_km: Mapped[int] = mapped_column(Integer, default=50, server_default="50")

    user: Mapped["User"] = relationship(back_populates="buyer_profile")


class SupplierProfile(Base):
    __tablename__ = "supplier_profiles"

    user_id: Mapped["UUID"] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    business_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    categories: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    coverage_area: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    contact_whatsapp: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    user: Mapped["User"] = relationship(back_populates="supplier_profile")
