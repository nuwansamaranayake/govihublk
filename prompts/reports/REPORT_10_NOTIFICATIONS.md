# Report 10 — Notifications Module

## Summary

Implemented the complete GoviHub Notifications Module across six new files and one updated file.

---

## Files Created

### 1. `govihub-api/app/notifications/schemas.py`

Pydantic schemas for the notifications API:

| Schema | Purpose |
|---|---|
| `NotificationRead` | Full notification record returned to clients |
| `NotificationListFilter` | Query parameter model (type, channel, is_read, page, size) |
| `UnreadCountResponse` | Wraps the integer unread count |
| `NotificationPreferenceRead` | Full preference record including quiet hours |
| `NotificationPreferenceUpdate` | Partial update — all fields optional |

---

### 2. `govihub-api/app/notifications/service.py`

`NotificationService` — the core business logic class:

**`NOTIFICATION_DEFAULTS` dict** maps every `NotificationType` to:
- Default delivery channels (in_app / push / sms combinations)
- `critical` flag (only `weather_alert` is critical — bypasses quiet hours)

**Public methods:**

| Method | Behaviour |
|---|---|
| `send_notification(user_id, type, title, body, data, channels)` | Checks preferences, quiet hours; creates DB records; dispatches push/SMS |
| `list_notifications(user_id, filters...)` | Paginated query with type/channel/is_read filters |
| `mark_read(notification_id, user_id)` | Marks one notification read; raises 404 if not owned |
| `mark_all_read(user_id)` | Bulk UPDATE; returns row count |
| `get_unread_count(user_id)` | `COUNT()` query on unread in_app/push rows |
| `get_or_create_preferences(user_id)` | Upsert-style preference fetch |
| `update_preferences(user_id, **updates)` | Partial field update |

**Quiet hours logic** handles overnight windows (e.g. 22:00 → 06:00). Critical notifications bypass this entirely.

---

### 3. `govihub-api/app/notifications/fcm.py`

`FCMService` singleton wrapping Firebase Admin SDK:

- `initialize()` — lazy load; gracefully skips if `FCM_CREDENTIALS_PATH` file is absent or `firebase_admin` is not installed
- `send_push(fcm_token, title, body, data)` — sends via `firebase_admin.messaging`; data values are coerced to strings (FCM requirement); returns `bool`
- Module-level `fcm_service` instance used by `NotificationService`

---

### 4. `govihub-api/app/notifications/sms.py`

`SMSService` singleton for Twilio SMS via `httpx`:

- `_check_config()` — validates `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` once; logs warning if absent
- `send_sms(phone, message)` — async `httpx.AsyncClient` POST to Twilio Messages API with Basic Auth; returns `bool`
- Graceful skip if `httpx` not installed or credentials missing
- Module-level `sms_service` instance

---

### 5. `govihub-api/app/notifications/helpers.py`

Domain-specific convenience helpers:

| Function | Description |
|---|---|
| `notify_match_found(db, match, farmer, buyer)` | Sends to both parties with match score and role context |
| `notify_match_accepted(db, match, accepting_user, other_user)` | Notifies the non-accepting party only |
| `notify_weather_alert(db, user_id, alert_type, details)` | Maps alert_type to a title; sends critical notification |
| `notify_price_alert(db, user_id, crop_name, price_change)` | Computes direction/magnitude; sends price_alert |

All helpers swallow exceptions internally and log warnings, ensuring notification failures never crash the caller.

---

### 6. `govihub-api/app/notifications/router.py`

FastAPI router mounted at `/api/v1/notifications`:

| Method | Path | Description |
|---|---|---|
| `GET` | `/notifications` | List user's notifications (filterable, paginated) |
| `GET` | `/notifications/unread-count` | Returns `{ unread_count: N }` |
| `PATCH` | `/notifications/read-all` | Marks all unread as read, returns count |
| `PATCH` | `/notifications/{notification_id}/read` | Marks one notification read |
| `GET` | `/notifications/preferences` | Fetch (or create default) preferences |
| `PUT` | `/notifications/preferences` | Partial-update preferences |

All endpoints require `get_current_active_user`.

---

## Files Updated

### `govihub-api/app/main.py`

- Uncommented `from app.notifications.router import router as notifications_router`
- Uncommented `app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["Notifications"])`

---

## Design Decisions

- **Graceful degradation** — both FCM and Twilio are optional; missing credentials produce warnings not errors, keeping local dev fully functional.
- **Critical flag** — `weather_alert` bypasses quiet hours to ensure urgent agricultural warnings always reach farmers via all available channels.
- **In-app always delivered** — when quiet hours suppress push/SMS, `in_app` is always the final fallback so users never miss a notification entirely.
- **Preference category filters** — match/weather/price alert categories respect the boolean flags while still storing an `in_app` record for the notification centre.
- **Separate DB record per channel** — each channel creates its own `Notification` row, allowing independent read/sent tracking.
