"""GoviHub Notifications Router — In-app notifications and preference management."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_complete_profile
from app.notifications.models import NotificationChannel, NotificationType
from app.notifications.schemas import (
    NotificationListFilter,
    NotificationPreferenceRead,
    NotificationPreferenceUpdate,
    NotificationRead,
    UnreadCountResponse,
)
from app.notifications.service import NotificationService
from app.users.models import User

router = APIRouter()


# ---------------------------------------------------------------------------
# Notification endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=list[NotificationRead], summary="List my notifications")
async def list_notifications(
    type: NotificationType = Query(None, description="Filter by notification type"),
    channel: NotificationChannel = Query(None, description="Filter by channel"),
    is_read: bool = Query(None, description="Filter by read status"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Return paginated notifications for the authenticated user."""
    svc = NotificationService(db)
    notifications = await svc.list_notifications(
        user_id=current_user.id,
        type=type,
        channel=channel,
        is_read=is_read,
        page=page,
        size=size,
    )
    return notifications


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Get unread notification count",
)
async def get_unread_count(
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Return the number of unread notifications for the authenticated user."""
    svc = NotificationService(db)
    count = await svc.get_unread_count(user_id=current_user.id)
    return UnreadCountResponse(unread_count=count)


@router.patch(
    "/read-all",
    response_model=UnreadCountResponse,
    summary="Mark all notifications as read",
)
async def mark_all_read(
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Mark every unread notification as read for the authenticated user.

    Returns the count of notifications that were updated.
    """
    svc = NotificationService(db)
    updated = await svc.mark_all_read(user_id=current_user.id)
    await db.commit()
    return UnreadCountResponse(unread_count=updated)


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationRead,
    summary="Mark a notification as read",
)
async def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Mark a single notification as read.

    Returns 404 if the notification does not exist or does not belong to the
    authenticated user.
    """
    svc = NotificationService(db)
    notif = await svc.mark_read(notification_id=notification_id, user_id=current_user.id)
    await db.commit()
    return notif


# ---------------------------------------------------------------------------
# Preference endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/preferences",
    response_model=NotificationPreferenceRead,
    summary="Get my notification preferences",
)
async def get_preferences(
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Return the notification preferences for the authenticated user.

    Creates default preferences on first access.
    """
    svc = NotificationService(db)
    prefs = await svc.get_or_create_preferences(user_id=current_user.id)
    await db.commit()
    return prefs


@router.put(
    "/preferences",
    response_model=NotificationPreferenceRead,
    summary="Update my notification preferences",
)
async def update_preferences(
    body: NotificationPreferenceUpdate,
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Update notification preferences for the authenticated user.

    Only the fields included in the request body are modified (partial update
    semantics despite using PUT, matching frontend expectations).
    """
    svc = NotificationService(db)
    updates = body.model_dump(exclude_unset=True)
    prefs = await svc.update_preferences(user_id=current_user.id, **updates)
    await db.commit()
    return prefs
