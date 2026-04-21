"""GoviHub Matching Model — Match."""

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    CheckConstraint, DateTime, Enum, Float, ForeignKey, Index, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MatchStatus(str, enum.Enum):
    proposed = "proposed"
    accepted = "accepted"
    completed = "completed"
    dismissed = "dismissed"


class Match(Base):
    __tablename__ = "matches"

    harvest_id: Mapped["UUID"] = mapped_column(
        UUID(as_uuid=True), ForeignKey("harvest_listings.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    demand_id: Mapped["UUID"] = mapped_column(
        UUID(as_uuid=True), ForeignKey("demand_postings.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    score: Mapped[float] = mapped_column(Float, nullable=False)
    score_breakdown: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    status: Mapped[MatchStatus] = mapped_column(
        Enum(MatchStatus, name="match_status", create_constraint=True),
        default=MatchStatus.proposed,
        server_default="proposed",
        index=True,
    )
    agreed_price_per_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    agreed_quantity_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    fulfilled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sector: Mapped[Optional[str]] = mapped_column(String(50), default="general", server_default="general", index=True)

    # Relationships
    harvest: Mapped["app.listings.models.HarvestListing"] = relationship(foreign_keys=[harvest_id])
    demand: Mapped["app.listings.models.DemandPosting"] = relationship(foreign_keys=[demand_id])

    __table_args__ = (
        UniqueConstraint("harvest_id", "demand_id", name="uq_matches_harvest_demand"),
        CheckConstraint(
            "status IN ('proposed', 'accepted', 'completed', 'dismissed')",
            name="match_status_check",
        ),
        Index("ix_matches_harvest_status", "harvest_id", "status"),
        Index("ix_matches_demand_status", "demand_id", "status"),
    )
