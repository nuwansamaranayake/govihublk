"""GoviHub Email Service — SendGrid-backed transactional email sender.

Used by admin automations (daily reports, alerts) via the MCP tool
`send_admin_email`. The service is lazy-initialised so the API container
still starts when SendGrid credentials are absent; the first call to
`send_html` raises if the key is missing.
"""

from __future__ import annotations

from typing import Optional

import structlog

from app.config import settings

logger = structlog.get_logger()


class EmailService:
    """Thin wrapper around the SendGrid Python SDK.

    The SDK is imported lazily in `send_html` so missing package installs
    or missing API keys don't break module import at API startup.
    """

    def __init__(self) -> None:
        self.api_key = settings.SENDGRID_API_KEY
        self.from_email = settings.SENDGRID_FROM_EMAIL
        self.from_name = settings.SENDGRID_FROM_NAME
        self._client = None

    def _ensure_ready(self) -> None:
        if not self.api_key:
            raise RuntimeError("SENDGRID_API_KEY not configured")
        if not self.from_email:
            raise RuntimeError("SENDGRID_FROM_EMAIL not configured")

    def send_html(
        self,
        to: list[str],
        subject: str,
        html_body: str,
        cc: Optional[list[str]] = None,
        bcc: Optional[list[str]] = None,
        plain_text_fallback: Optional[str] = None,
    ) -> dict:
        """Send an HTML email via SendGrid.

        Returns `{status_code, message_id, recipient_count}` on success.
        Raises on any SendGrid error; callers handle the exception loudly.
        """
        self._ensure_ready()

        if not to or not isinstance(to, list):
            raise ValueError("`to` must be a non-empty list of email addresses")

        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Bcc, Cc, Content, Email, Mail, To

        if self._client is None:
            self._client = SendGridAPIClient(self.api_key)

        message = Mail(
            from_email=Email(self.from_email, self.from_name),
            to_emails=[To(addr) for addr in to],
            subject=subject,
            html_content=Content("text/html", html_body),
        )

        if cc:
            for addr in cc:
                message.add_cc(Cc(addr))
        if bcc:
            for addr in bcc:
                message.add_bcc(Bcc(addr))

        if plain_text_fallback:
            message.add_content(Content("text/plain", plain_text_fallback))

        try:
            response = self._client.send(message)
        except Exception as exc:
            logger.error("sendgrid_send_failed", error=str(exc), subject=subject)
            raise

        message_id = response.headers.get("X-Message-Id", "unknown")
        logger.info(
            "sendgrid_email_sent",
            to_count=len(to),
            cc_count=len(cc or []),
            bcc_count=len(bcc or []),
            subject=subject,
            status_code=response.status_code,
            message_id=message_id,
        )
        return {
            "status_code": response.status_code,
            "message_id": message_id,
            "recipient_count": len(to) + len(cc or []) + len(bcc or []),
        }


email_service = EmailService()
