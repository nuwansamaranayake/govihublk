"""GoviHub Notification Tests — Creation, mark read, unread count, preferences."""

from __future__ import annotations

import uuid

import pytest

from app.auth.service import create_access_token
from app.notifications.models import (
    Notification,
    NotificationChannel,
    NotificationType,
)


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Notification model unit tests
# ---------------------------------------------------------------------------

def test_notification_type_enum_values():
    """NotificationType enum contains all expected notification types."""
    types = {t.value for t in NotificationType}
    assert "match_found" in types
    assert "match_accepted" in types
    assert "match_confirmed" in types
    assert "match_fulfilled" in types
    assert "price_alert" in types
    assert "weather_alert" in types
    assert "diagnosis_complete" in types
    assert "system_message" in types


def test_notification_channel_enum_values():
    """NotificationChannel enum has all expected delivery channels."""
    channels = {c.value for c in NotificationChannel}
    assert "push" in channels
    assert "sms" in channels
    assert "in_app" in channels


def test_notification_creation_fields():
    """Notification model can be instantiated with required fields."""
    notif = Notification(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        type=NotificationType.match_found,
        channel=NotificationChannel.in_app,
        title="New Match",
        body="A buyer matched your harvest",
        is_read=False,
        is_sent=True,
    )
    assert notif.is_read is False
    assert notif.channel == NotificationChannel.in_app
    assert notif.type == NotificationType.match_found


# ---------------------------------------------------------------------------
# Notification API tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_notifications_requires_auth(client):
    """Notifications endpoint requires authentication."""
    resp = await client.get("/api/v1/notifications")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_notifications_authenticated(client, farmer_user, notification):
    """Authenticated user can list their notifications."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.get("/api/v1/notifications", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data or isinstance(data, list)


@pytest.mark.asyncio
async def test_unread_count_endpoint(client, farmer_user, notification):
    """Unread count endpoint returns a count of unread notifications."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.get("/api/v1/notifications/unread-count", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "count" in data or "unread_count" in data or isinstance(data, int)


@pytest.mark.asyncio
async def test_mark_notification_read(client, farmer_user, notification):
    """User can mark a notification as read."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.patch(
        f"/api/v1/notifications/{notification.id}/read",
        headers=_auth(token),
    )
    assert resp.status_code in (200, 204)


@pytest.mark.asyncio
async def test_mark_all_notifications_read(client, farmer_user, notification):
    """User can mark all notifications as read."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.post(
        "/api/v1/notifications/mark-all-read",
        headers=_auth(token),
    )
    assert resp.status_code in (200, 204)


@pytest.mark.asyncio
async def test_get_notification_preferences(client, farmer_user):
    """User can retrieve their notification preferences."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.get("/api/v1/notifications/preferences", headers=_auth(token))
    assert resp.status_code in (200, 404)  # 404 if no prefs set yet


@pytest.mark.asyncio
async def test_update_notification_preferences(client, farmer_user):
    """User can update their notification preferences."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    payload = {
        "push_enabled": True,
        "sms_enabled": False,
        "match_alerts": True,
        "weather_alerts": True,
        "price_alerts": False,
    }
    resp = await client.put(
        "/api/v1/notifications/preferences",
        json=payload,
        headers=_auth(token),
    )
    assert resp.status_code in (200, 201)
    if resp.status_code in (200, 201):
        data = resp.json()
        assert data.get("sms_enabled") is False


@pytest.mark.asyncio
async def test_cannot_read_other_users_notification(client, buyer_user, notification):
    """User cannot mark another user's notification as read."""
    token = create_access_token(user_id=buyer_user.id, role="buyer")
    resp = await client.patch(
        f"/api/v1/notifications/{notification.id}/read",
        headers=_auth(token),
    )
    # Should return 403 or 404 for unauthorized access
    assert resp.status_code in (403, 404)
