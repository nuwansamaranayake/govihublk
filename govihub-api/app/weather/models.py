"""Weather Models — Farmer crop selections and weather alerts."""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FarmerCropSelection(Base):
    """Tracks which crops a farmer cultivates and their growth stages."""

    __tablename__ = "farmer_crop_selections"
    __table_args__ = (
        UniqueConstraint("user_id", "crop_type", name="uq_farmer_crops_user_crop"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    crop_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    growth_stage: Mapped[Optional[str]] = mapped_column(String(50), server_default="vegetative")
    area_hectares: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, server_default="false")


class WeatherAlert(Base):
    """Stores generated weather alerts for farmers based on their crops."""

    __tablename__ = "weather_alerts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    crop_type: Mapped[str] = mapped_column(String(50), nullable=False)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, server_default="info")
    forecast_date: Mapped[date] = mapped_column(Date, nullable=False)
    message_si: Mapped[str] = mapped_column(Text, nullable=False)
    message_en: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    weather_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, server_default="false")
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
