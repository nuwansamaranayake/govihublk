"""GoviHub Notification Schemas — Request/response models for the notifications module."""

from datetime import datetime, time
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.notifications.models import NotificationChannel, NotificationType


# ---------------------------------------------------------------------------
# Notification read schema
# ---------------------------------------------------------------------------


class NotificationRead(BaseModel):
    """Full notification detail returned to clients."""

    id: UUID
    user_id: UUID
    type: NotificationType
    channel: NotificationChannel
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None
    is_read: bool
    is_sent: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# List / filter
# ---------------------------------------------------------------------------


class NotificationListFilter(BaseModel):
    """Query parameters for listing notifications."""

    type: Optional[NotificationType] = Field(None, description="Filter by notification type")
    channel: Optional[NotificationChannel] = Field(None, description="Filter by delivery channel")
    is_read: Optional[bool] = Field(None, description="Filter by read status")
    page: int = Field(1, ge=1, description="Page number (1-based)")
    size: int = Field(20, ge=1, le=100, description="Items per page")


# ---------------------------------------------------------------------------
# Unread count
# ---------------------------------------------------------------------------


class UnreadCountResponse(BaseModel):
    """Response schema for the unread notification count endpoint."""

    unread_count: int = Field(..., ge=0, description="Number of unread notifications")


# ---------------------------------------------------------------------------
# Notification preference schemas
# ---------------------------------------------------------------------------


class NotificationPreferenceRead(BaseModel):
    """Notification preference settings for a user."""

    id: UUID
    user_id: UUID
    push_enabled: bool
    sms_enabled: bool
    match_alerts: bool
    weather_alerts: bool
    price_alerts: bool
    quiet_hours_start: Optional[time] = None
    quiet_hours_end: Optional[time] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NotificationPreferenceUpdate(BaseModel):
    """Partial update for notification preferences."""

    push_enabled: Optional[bool] = None
    sms_enabled: Optional[bool] = None
    match_alerts: Optional[bool] = None
    weather_alerts: Optional[bool] = None
    price_alerts: Optional[bool] = None
    quiet_hours_start: Optional[time] = Field(
        None, description="Quiet hours begin (24-hour time, e.g. 22:00)"
    )
    quiet_hours_end: Optional[time] = Field(
        None, description="Quiet hours end (24-hour time, e.g. 06:00)"
    )
