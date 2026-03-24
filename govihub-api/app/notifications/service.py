"""GoviHub Notification Service — Send, list, and manage notifications."""

from __future__ import annotations

from datetime import datetime, time, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

import structlog
from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError
from app.notifications.models import (
    Notification,
    NotificationChannel,
    NotificationPreference,
    NotificationType,
)

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Default channel and criticality mapping per notification type
# ---------------------------------------------------------------------------

NOTIFICATION_DEFAULTS: Dict[str, Dict] = {
    NotificationType.match_found: {
        "channels": [NotificationChannel.in_app, NotificationChannel.push],
        "critical": False,
    },
    NotificationType.match_accepted: {
        "channels": [NotificationChannel.in_app, NotificationChannel.push],
        "critical": False,
    },
    NotificationType.match_confirmed: {
        "channels": [NotificationChannel.in_app, NotificationChannel.push, NotificationChannel.sms],
        "critical": False,
    },
    NotificationType.match_fulfilled: {
        "channels": [NotificationChannel.in_app, NotificationChannel.push],
        "critical": False,
    },
    NotificationType.price_alert: {
        "channels": [NotificationChannel.in_app, NotificationChannel.push],
        "critical": False,
    },
    NotificationType.weather_alert: {
        "channels": [NotificationChannel.in_app, NotificationChannel.push, NotificationChannel.sms],
        "critical": True,
    },
    NotificationType.diagnosis_complete: {
        "channels": [NotificationChannel.in_app, NotificationChannel.push],
        "critical": False,
    },
    NotificationType.system_message: {
        "channels": [NotificationChannel.in_app],
        "critical": False,
    },
}


def _is_quiet_hours(prefs: NotificationPreference) -> bool:
    """Return True if the current UTC time falls within the user's quiet hours."""
    if prefs.quiet_hours_start is None or prefs.quiet_hours_end is None:
        return False

    now: time = datetime.now(timezone.utc).time().replace(tzinfo=None)
    start = prefs.quiet_hours_start
    end = prefs.quiet_hours_end

    # Handle overnight windows (e.g., 22:00 → 06:00)
    if start <= end:
        return start <= now < end
    else:
        return now >= start or now < end


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Core send method
    # ------------------------------------------------------------------

    async def send_notification(
        self,
        user_id: UUID,
        type: NotificationType,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        channels: Optional[List[NotificationChannel]] = None,
    ) -> List[Notification]:
        """Create notification records and dispatch to configured channels.

        Respects user preferences and quiet hours. Critical notifications
        (weather_alert) bypass quiet hours checks.
        """
        db = self.db

        # Fetch or initialise user preferences
        result = await db.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        )
        prefs: Optional[NotificationPreference] = result.scalar_one_or_none()

        # Determine default channels if none explicitly provided
        defaults = NOTIFICATION_DEFAULTS.get(
            type,
            {"channels": [NotificationChannel.in_app], "critical": False},
        )
        is_critical: bool = defaults["critical"]
        effective_channels: List[NotificationChannel] = channels or defaults["channels"]

        # Apply preference filters
        if prefs:
            filtered: List[NotificationChannel] = []
            for ch in effective_channels:
                if ch == NotificationChannel.push and not prefs.push_enabled:
                    continue
                if ch == NotificationChannel.sms and not prefs.sms_enabled:
                    continue
                # Category-level filters
                if type in (
                    NotificationType.match_found,
                    NotificationType.match_accepted,
                    NotificationType.match_confirmed,
                    NotificationType.match_fulfilled,
                ) and not prefs.match_alerts:
                    if ch != NotificationChannel.in_app:
                        continue
                if type == NotificationType.weather_alert and not prefs.weather_alerts:
                    if ch != NotificationChannel.in_app:
                        continue
                if type == NotificationType.price_alert and not prefs.price_alerts:
                    if ch != NotificationChannel.in_app:
                        continue
                filtered.append(ch)
            effective_channels = filtered or [NotificationChannel.in_app]

        # Quiet hours — suppress push/SMS but keep in_app; skip for critical
        in_quiet = (not is_critical) and prefs and _is_quiet_hours(prefs)
        if in_quiet:
            effective_channels = [
                ch for ch in effective_channels if ch == NotificationChannel.in_app
            ] or [NotificationChannel.in_app]

        created: List[Notification] = []

        for channel in effective_channels:
            notif = Notification(
                user_id=user_id,
                type=type,
                channel=channel,
                title=title,
                body=body,
                data=data,
            )
            db.add(notif)
            await db.flush()
            created.append(notif)

            # Dispatch external delivery
            if channel == NotificationChannel.push:
                await self._dispatch_push(user_id, notif)
            elif channel == NotificationChannel.sms:
                await self._dispatch_sms(user_id, notif)

        logger.info(
            "notifications_sent",
            user_id=str(user_id),
            type=type.value,
            channels=[ch.value for ch in effective_channels],
        )
        return created

    # ------------------------------------------------------------------
    # Query helpers
    # ------------------------------------------------------------------

    async def list_notifications(
        self,
        user_id: UUID,
        *,
        type: Optional[NotificationType] = None,
        channel: Optional[NotificationChannel] = None,
        is_read: Optional[bool] = None,
        page: int = 1,
        size: int = 20,
    ) -> List[Notification]:
        """Return paginated notifications for a user."""
        query = select(Notification).where(Notification.user_id == user_id)

        if type is not None:
            query = query.where(Notification.type == type)
        if channel is not None:
            query = query.where(Notification.channel == channel)
        if is_read is not None:
            query = query.where(Notification.is_read == is_read)

        query = (
            query.order_by(Notification.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def mark_read(self, notification_id: UUID, user_id: UUID) -> Notification:
        """Mark a single notification as read."""
        notif = await self.db.get(Notification, notification_id)
        if notif is None or notif.user_id != user_id:
            raise NotFoundError(detail="Notification not found")
        notif.is_read = True
        await self.db.flush()
        return notif

    async def mark_all_read(self, user_id: UUID) -> int:
        """Mark all unread notifications for a user as read. Returns count updated."""
        stmt = (
            update(Notification)
            .where(
                and_(
                    Notification.user_id == user_id,
                    Notification.is_read == False,  # noqa: E712
                )
            )
            .values(is_read=True)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.rowcount

    async def get_unread_count(self, user_id: UUID) -> int:
        """Return the count of unread notifications for a user."""
        result = await self.db.execute(
            select(func.count(Notification.id)).where(
                and_(
                    Notification.user_id == user_id,
                    Notification.is_read == False,  # noqa: E712
                )
            )
        )
        return result.scalar_one() or 0

    # ------------------------------------------------------------------
    # Preference management
    # ------------------------------------------------------------------

    async def get_or_create_preferences(self, user_id: UUID) -> NotificationPreference:
        """Fetch notification preferences for a user, creating defaults if absent."""
        result = await self.db.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        )
        prefs = result.scalar_one_or_none()
        if prefs is None:
            prefs = NotificationPreference(user_id=user_id)
            self.db.add(prefs)
            await self.db.flush()
        return prefs

    async def update_preferences(
        self,
        user_id: UUID,
        **updates: Any,
    ) -> NotificationPreference:
        """Update notification preferences for a user."""
        prefs = await self.get_or_create_preferences(user_id)
        for field, value in updates.items():
            if value is not None and hasattr(prefs, field):
                setattr(prefs, field, value)
        await self.db.flush()
        return prefs

    # ------------------------------------------------------------------
    # Internal dispatch helpers
    # ------------------------------------------------------------------

    async def _dispatch_push(self, user_id: UUID, notif: Notification) -> None:
        """Look up FCM token and send push notification."""
        try:
            from app.users.models import User

            user = await self.db.get(User, user_id)
            if user is None:
                return

            # FCM token stored on farmer/buyer/supplier profile or user extension
            # Fall back gracefully if no token is found
            fcm_token: Optional[str] = None
            if hasattr(user, "farmer_profile") and user.farmer_profile:
                fcm_token = getattr(user.farmer_profile, "fcm_token", None)
            if not fcm_token and hasattr(user, "buyer_profile") and user.buyer_profile:
                fcm_token = getattr(user.buyer_profile, "fcm_token", None)

            if not fcm_token:
                logger.debug("no_fcm_token", user_id=str(user_id))
                return

            from app.notifications.fcm import fcm_service

            success = await fcm_service.send_push(
                fcm_token=fcm_token,
                title=notif.title,
                body=notif.body,
                data=notif.data or {},
            )
            if success:
                notif.is_sent = True
        except Exception as exc:  # pragma: no cover
            logger.warning("push_dispatch_error", user_id=str(user_id), error=str(exc))

    async def _dispatch_sms(self, user_id: UUID, notif: Notification) -> None:
        """Look up phone number and send SMS."""
        try:
            from app.users.models import User

            user = await self.db.get(User, user_id)
            if user is None or not user.phone:
                logger.debug("no_phone_number", user_id=str(user_id))
                return

            from app.notifications.sms import sms_service

            success = await sms_service.send_sms(
                phone=user.phone,
                message=f"{notif.title}: {notif.body}",
            )
            if success:
                notif.is_sent = True
        except Exception as exc:  # pragma: no cover
            logger.warning("sms_dispatch_error", user_id=str(user_id), error=str(exc))
