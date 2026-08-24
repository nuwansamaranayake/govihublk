"""GoviHub Moderation Model — ModerationEvent audit trail.

One table records events for two listing tables (`supply_listings` and
`harvest_listings`), discriminated by `listing_type`. `listing_id` therefore
carries no foreign key — see migration 015.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Column value vocabularies. Kept as plain strings (not PG enums) so a new
# verdict or kind never needs a migration.
LISTING_TYPES = ("supply", "harvest")
MODERATION_KINDS = ("text", "image")
MODERATION_VERDICTS = ("clean", "flagged", "error")

# moderation_status values carried on the listing rows themselves.
STATUS_PENDING = "pending_scan"
STATUS_CLEAN = "clean"
STATUS_FLAGGED = "flagged"
STATUS_REVIEWED = "reviewed"


class ModerationEvent(Base):
    __tablename__ = "moderation_events"

    listing_type: Mapped[str] = mapped_column(String(20), nullable=False)
    listing_id: Mapped["UUID"] = mapped_column(UUID(as_uuid=True), nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    verdict: Mapped[str] = mapped_column(String(20), nullable=False)
    model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_moderation_events_listing", "listing_type", "listing_id"),
    )
