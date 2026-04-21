"""GoviHub Advertisement Models."""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class Advertisement(Base):
    __tablename__ = "advertisements"

    # Content
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    title_si: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_si: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    click_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Targeting
    target_roles = mapped_column(JSONB, default=["farmer", "buyer", "supplier"])
    target_districts = mapped_column(JSONB, default=[])

    # Scheduling
    starts_at = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ends_at = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Advertiser info
    advertiser_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    advertiser_contact: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Display
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    # Tracking counters (denormalized)
    impression_count: Mapped[int] = mapped_column(Integer, default=0)
    click_count: Mapped[int] = mapped_column(Integer, default=0)

    # Creator
    created_by = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    __table_args__ = (
        Index("idx_ads_active", "is_active", "starts_at", "ends_at"),
        Index("idx_ads_order", "display_order"),
    )


class AdEvent(Base):
    __tablename__ = "ad_events"

    ad_id = mapped_column(
        UUID(as_uuid=True), ForeignKey("advertisements.id", ondelete="CASCADE"), nullable=False
    )
    user_id = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(20), nullable=False)
    user_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    user_district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    page_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    __table_args__ = (
        Index("idx_ad_events_ad", "ad_id", "event_type"),
        Index("idx_ad_events_date", "created_at"),
    )
