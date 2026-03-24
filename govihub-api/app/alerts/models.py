"""GoviHub Alerts Models — PriceHistory, WeatherCache."""

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PriceHistory(Base):
    __tablename__ = "price_history"

    crop_id: Mapped["UUID"] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crop_taxonomy.id", ondelete="CASCADE"),
        nullable=False,
    )
    market_name: Mapped[str] = mapped_column(String(255), nullable=False)
    price_per_kg: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), default="LKR", server_default="LKR")
    recorded_date: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    __table_args__ = (
        Index("ix_price_history_crop_date", "crop_id", "recorded_date"),
        Index("ix_price_history_market", "market_name"),
    )


class WeatherCache(Base):
    __tablename__ = "weather_cache"

    gn_division: Mapped[str] = mapped_column(String(100), nullable=False)
    forecast_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_weather_cache_gn", "gn_division"),
        Index("ix_weather_cache_expires", "expires_at"),
    )
