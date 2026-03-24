"""GoviHub FCM Service — Firebase Cloud Messaging push notifications."""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

import structlog

logger = structlog.get_logger()


class FCMService:
    """Wrapper around the Firebase Admin SDK for sending push notifications.

    Initialisation is lazy and graceful — if FCM credentials are absent or
    invalid the service operates in a no-op mode so the rest of the
    application continues to function normally.
    """

    def __init__(self) -> None:
        self._app: Optional[Any] = None
        self._initialized: bool = False
        self._unavailable: bool = False

    def initialize(self) -> None:
        """Load Firebase Admin SDK credentials.

        Called once at startup (or on first use).  Silently skips if
        ``FCM_CREDENTIALS_PATH`` points to a non-existent file or if the
        ``firebase_admin`` package is not installed.
        """
        if self._initialized or self._unavailable:
            return

        try:
            import firebase_admin  # type: ignore
            from firebase_admin import credentials  # type: ignore

            from app.config import settings

            creds_path = settings.FCM_CREDENTIALS_PATH

            if not os.path.exists(creds_path):
                logger.warning(
                    "fcm_credentials_not_found",
                    path=creds_path,
                    note="FCM push notifications disabled",
                )
                self._unavailable = True
                return

            cred = credentials.Certificate(creds_path)
            # Avoid re-initialising if the default app already exists
            if not firebase_admin._apps:
                self._app = firebase_admin.initialize_app(cred)
            else:
                self._app = firebase_admin.get_app()

            self._initialized = True
            logger.info("fcm_initialized", credentials_path=creds_path)

        except ImportError:
            logger.warning(
                "firebase_admin_not_installed",
                note="Install firebase-admin to enable FCM push notifications",
            )
            self._unavailable = True
        except Exception as exc:
            logger.error("fcm_init_error", error=str(exc))
            self._unavailable = True

    async def send_push(
        self,
        fcm_token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Send a push notification to a single device.

        Args:
            fcm_token: The device FCM registration token.
            title: Notification title.
            body: Notification body text.
            data: Optional key-value payload attached to the message.

        Returns:
            True if the message was accepted by FCM, False otherwise.
        """
        self.initialize()

        if self._unavailable or not self._initialized:
            logger.debug("fcm_unavailable_skip", token_prefix=fcm_token[:8] if fcm_token else "")
            return False

        try:
            from firebase_admin import messaging  # type: ignore

            # FCM data values must be strings
            str_data: Dict[str, str] = {}
            if data:
                str_data = {k: str(v) for k, v in data.items()}

            message = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                data=str_data,
                token=fcm_token,
            )

            response = messaging.send(message)
            logger.info("fcm_message_sent", message_id=response, token_prefix=fcm_token[:8])
            return True

        except Exception as exc:
            logger.error(
                "fcm_send_error",
                error=str(exc),
                token_prefix=fcm_token[:8] if fcm_token else "",
            )
            return False


# Module-level singleton
fcm_service = FCMService()
