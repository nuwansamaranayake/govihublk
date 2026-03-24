"""GoviHub Notification Models — Notification, NotificationPreference."""

import enum
from datetime import time
from typing import Optional

from sqlalchemy import Boolean, Enum, ForeignKey, Index, String, Text, Time
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class NotificationType(str, enum.Enum):
    match_found = "match_found"
    match_accepted = "match_accepted"
    match_confirmed = "match_confirmed"
    match_fulfilled = "match_fulfilled"
    price_alert = "price_alert"
    weather_alert = "weather_alert"
    diagnosis_complete = "diagnosis_complete"
    system_message = "system_message"


class NotificationChannel(str, enum.Enum):
    push = "push"
    sms = "sms"
    in_app = "in_app"


class Notification(Base):
    __tablename__ = "notifications"

    user_id: Mapped["UUID"] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type", create_constraint=True),
        nullable=False,
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        Enum(NotificationChannel, name="notification_channel", create_constraint=True),
        default=NotificationChannel.in_app,
        server_default="in_app",
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_sent: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    user: Mapped["app.users.models.User"] = relationship(foreign_keys=[user_id])

    __table_args__ = (
        Index("ix_notifications_user_read", "user_id", "is_read"),
        Index("ix_notifications_user_created", "user_id", "created_at"),
    )


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    user_id: Mapped["UUID"] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        unique=True, nullable=False,
    )
    push_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    sms_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    match_alerts: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    weather_alerts: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    price_alerts: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    quiet_hours_start: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    quiet_hours_end: Mapped[Optional[time]] = mapped_column(Time, nullable=True)

    user: Mapped["app.users.models.User"] = relationship(foreign_keys=[user_id])
