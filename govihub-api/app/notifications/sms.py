"""GoviHub SMS Service — Twilio-based SMS delivery via httpx."""

from __future__ import annotations

from typing import Optional

import structlog

logger = structlog.get_logger()


class SMSService:
    """Send SMS messages via Twilio's REST API using httpx.

    The service degrades gracefully when Twilio credentials are absent or
    when httpx is unavailable — callers receive ``False`` rather than an
    exception.
    """

    def __init__(self) -> None:
        self._configured: Optional[bool] = None  # None = not yet checked

    def _check_config(self) -> bool:
        """Return True if all required Twilio settings are present."""
        if self._configured is not None:
            return self._configured

        try:
            from app.config import settings

            configured = bool(
                settings.TWILIO_ACCOUNT_SID
                and settings.TWILIO_AUTH_TOKEN
                and settings.TWILIO_FROM_NUMBER
            )
            if not configured:
                logger.warning(
                    "twilio_not_configured",
                    note="Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to enable SMS",
                )
            else:
                logger.info("twilio_sms_configured")

            self._configured = configured
        except Exception as exc:
            logger.error("sms_config_check_error", error=str(exc))
            self._configured = False

        return self._configured  # type: ignore[return-value]

    async def send_sms(self, phone: str, message: str) -> bool:
        """Send an SMS message to the given phone number.

        Uses Twilio's Messages API via an async httpx request.

        Args:
            phone: E.164 formatted phone number (e.g. ``+94771234567``).
            message: The SMS body text (kept ≤ 160 chars ideally).

        Returns:
            True if the message was queued by Twilio, False otherwise.
        """
        if not self._check_config():
            logger.debug("sms_skipped_not_configured", phone_prefix=phone[:6] if phone else "")
            return False

        try:
            import httpx

            from app.config import settings

            url = (
                f"https://api.twilio.com/2010-04-01/Accounts/"
                f"{settings.TWILIO_ACCOUNT_SID}/Messages.json"
            )
            payload = {
                "To": phone,
                "From": settings.TWILIO_FROM_NUMBER,
                "Body": message,
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    url,
                    data=payload,
                    auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                )

            if response.status_code in (200, 201):
                data = response.json()
                logger.info(
                    "sms_sent",
                    sid=data.get("sid"),
                    status=data.get("status"),
                    phone_prefix=phone[:6],
                )
                return True
            else:
                logger.error(
                    "sms_send_failed",
                    status_code=response.status_code,
                    body=response.text[:200],
                    phone_prefix=phone[:6],
                )
                return False

        except ImportError:
            logger.warning("httpx_not_installed", note="Install httpx to enable SMS delivery")
            return False
        except Exception as exc:
            logger.error("sms_send_error", error=str(exc), phone_prefix=phone[:6] if phone else "")
            return False


# Module-level singleton
sms_service = SMSService()
