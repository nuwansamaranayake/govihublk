"""GoviHub Beta Feedback Model — User feedback during beta testing."""

from typing import Optional

from sqlalchemy import ForeignKey, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BetaFeedback(Base):
    __tablename__ = "beta_feedback"

    user_id: Mapped[Optional["UUID"]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    page_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(30), server_default="general", default="general")
    language: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    status: Mapped[str] = mapped_column(String(20), server_default="new", default="new")
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
