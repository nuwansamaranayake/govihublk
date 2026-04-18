"""GoviHub Email Service — Resend-backed transactional email sender.

Used by admin automations (daily reports, alerts) via the MCP tool
`send_admin_email`. The service is lazy-initialised so the API container
still starts when Resend credentials are absent; the first call to
`send_html` raises if the key is missing.
"""

from __future__ import annotations

from typing import Optional

import structlog

from app.config import settings

logger = structlog.get_logger()


class EmailService:
    """Thin wrapper around the Resend Python SDK.

    The SDK is imported lazily in `send_html` so missing package installs
    or missing API keys don't break module import at API startup.
    """

    def __init__(self) -> None:
        self.api_key = settings.RESEND_API_KEY
        self.from_email = settings.RESEND_FROM_EMAIL
        self.from_name = settings.RESEND_FROM_NAME or "GoviHub Reports"
        self._configured = False

    def _ensure_ready(self) -> None:
        if not self.api_key:
            raise RuntimeError("RESEND_API_KEY not configured")
        if not self.from_email:
            raise RuntimeError("RESEND_FROM_EMAIL not configured")
        if not self._configured:
            import resend

            resend.api_key = self.api_key
            self._configured = True

    def _format_from(self) -> str:
        return f"{self.from_name} <{self.from_email}>"

    def send_html(
        self,
        to: list[str],
        subject: str,
        html_body: str,
        cc: Optional[list[str]] = None,
        bcc: Optional[list[str]] = None,
        reply_to: Optional[str] = None,
        plain_text_fallback: Optional[str] = None,
    ) -> dict:
        """Send an HTML email via Resend.

        Returns `{message_id, recipient_count}` on success.
        Raises on any Resend error; callers handle the exception loudly.
        """
        self._ensure_ready()

        if not to or not isinstance(to, list):
            raise ValueError("`to` must be a non-empty list of email addresses")

        import resend

        params: dict = {
            "from": self._format_from(),
            "to": to,
            "subject": subject,
            "html": html_body,
        }
        if cc:
            params["cc"] = cc
        if bcc:
            params["bcc"] = bcc
        if reply_to:
            params["reply_to"] = reply_to
        if plain_text_fallback:
            params["text"] = plain_text_fallback

        try:
            response = resend.Emails.send(params)
        except Exception as exc:
            logger.error("resend_send_failed", error=str(exc), subject=subject)
            raise

        # resend-python returns a dict-like object with at least an `id` key.
        message_id = (
            response.get("id") if isinstance(response, dict) else getattr(response, "id", None)
        ) or "unknown"
        recipient_count = len(to) + len(cc or []) + len(bcc or [])
        logger.info(
            "resend_email_sent",
            to_count=len(to),
            cc_count=len(cc or []),
            bcc_count=len(bcc or []),
            subject=subject,
            message_id=message_id,
        )
        return {
            "message_id": message_id,
            "recipient_count": recipient_count,
        }


email_service = EmailService()
