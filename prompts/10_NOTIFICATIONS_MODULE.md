# Prompt 10 — Notifications Module (FCM, SMS, In-App)

## Context
All business modules create events that need user notification. Build the dispatch system.

## Objective
Implement a unified notification service that dispatches via Firebase Cloud Messaging (push), SMS (Twilio), and in-app notifications. Include preference management and the in-app notification center API.

## Instructions

### 1. app/notifications/schemas.py

- `NotificationRead`: id, type, title, body, data (dict), is_read, channel, sent_at
- `NotificationListFilter`: type (opt), is_read (opt bool), page, size
- `UnreadCountResponse`: count (int)
- `NotificationPreferenceRead/Update`: push_enabled, sms_enabled, match_alerts, weather_alerts, price_alerts, quiet_hours_start, quiet_hours_end

### 2. app/notifications/service.py — NotificationService

Core dispatch method:
```python
async def send_notification(
    user_id: UUID,
    notification_type: str,  # match_found, weather_alert, price_alert, diagnosis_result, system
    title: str,
    body: str,
    data: dict = None,  # deep link data {match_id, listing_id, etc}
    channels: list[str] = None,  # ["push", "sms", "in_app"], defaults based on type
):
    """
    1. Check user notification preferences
    2. Check quiet hours
    3. Create Notification DB record (always — this is the in-app notification)
    4. If push_enabled and FCM token exists: send FCM push
    5. If sms_enabled and phone exists and type is critical: send SMS
    """
```

Additional methods:
- `list_notifications(user_id, filters)` → Paginated
- `mark_read(notification_id, user_id)` → Set is_read=True
- `mark_all_read(user_id)` → Batch update
- `get_unread_count(user_id)` → Count query
- `get_preferences(user_id)` → NotificationPreference
- `update_preferences(user_id, data)` → Update preferences

### 3. app/notifications/fcm.py — Firebase Cloud Messaging

```python
class FCMService:
    """Firebase Cloud Messaging push notification sender."""
    
    def __init__(self):
        self.initialized = False
    
    async def initialize(self):
        """Initialize Firebase Admin SDK. Skip if credentials not available."""
        try:
            import firebase_admin
            from firebase_admin import credentials
            cred_path = settings.FCM_CREDENTIALS_PATH
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
                self.initialized = True
            else:
                logger.warning("FCM credentials not found, push notifications disabled")
        except Exception as e:
            logger.warning(f"FCM initialization failed: {e}")
    
    async def send_push(self, fcm_token: str, title: str, body: str, data: dict = None):
        """Send push notification to a specific device."""
        if not self.initialized:
            logger.debug("FCM not initialized, skipping push")
            return False
        
        from firebase_admin import messaging
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            token=fcm_token,
        )
        try:
            messaging.send(message)
            return True
        except Exception as e:
            logger.error(f"FCM send failed: {e}")
            return False
```

### 4. app/notifications/sms.py — SMS Service

```python
class SMSService:
    """SMS notification via Twilio or local gateway."""
    
    async def send_sms(self, phone: str, message: str):
        """Send SMS. Graceful failure if not configured."""
        if not settings.TWILIO_ACCOUNT_SID:
            logger.debug("SMS not configured, skipping")
            return False
        
        # Twilio implementation
        # Format phone for Sri Lanka (+94...)
        # Send via Twilio REST API using httpx
        # Return True/False
```

### 5. Notification Type Configuration

Define default channels per notification type:
```python
NOTIFICATION_DEFAULTS = {
    "match_found": {"channels": ["push", "in_app"], "critical": False},
    "match_accepted": {"channels": ["push", "in_app"], "critical": False},
    "match_confirmed": {"channels": ["push", "sms", "in_app"], "critical": True},
    "weather_alert": {"channels": ["push", "in_app"], "critical": True},
    "price_alert": {"channels": ["push", "in_app"], "critical": False},
    "diagnosis_result": {"channels": ["push", "in_app"], "critical": False},
    "system": {"channels": ["in_app"], "critical": False},
}
```

Critical notifications ignore quiet hours and always send SMS if phone is available.

### 6. app/notifications/router.py

```
GET    /notifications                    — List my notifications (paginated)
GET    /notifications/unread-count       — Unread count
PATCH  /notifications/{id}/read          — Mark single as read
PATCH  /notifications/read-all           — Mark all as read
GET    /notifications/preferences        — Get my preferences
PUT    /notifications/preferences        — Update preferences
```

### 7. Helper Function for Other Modules

Create `app/notifications/helpers.py`:
```python
async def notify_match_found(db, match, farmer, buyer):
    """Send match_found notification to both parties."""
    
async def notify_match_accepted(db, match, accepting_user, other_user):
    """Send match_accepted to the other party."""
    
async def notify_weather_alert(db, user_id, alert_type, details):
    """Send weather alert."""
    
async def notify_price_alert(db, user_id, crop_name, price_change):
    """Send price alert."""
```

These helpers are called from the matching, alerts modules. They abstract away the notification dispatch logic.

### 8. Register Router and Startup

Add notifications router to main.py. Initialize FCM in lifespan.

## Verification

1. In-app notifications are created for all types
2. FCM push works when configured (graceful skip when not)
3. SMS sends for critical notifications when phone available
4. Quiet hours are respected (non-critical only)
5. User preferences control which notifications they receive
6. Unread count endpoint works
7. Mark read (single and batch) works
8. Pagination with type filter works

## Output Report
Write report to: `/home/claude/govihub-prompts/reports/REPORT_10_NOTIFICATIONS.md`
