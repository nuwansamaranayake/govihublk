"""Resend inbound email webhook.

Mail to any address at govihublk.com lands at Resend (catch-all), which POSTs
``email.received`` here. We forward a metadata notification to the admin
address. The payload carries no body or attachments by design — fetch those
from Resend's Received Emails API using ``email_id`` if ever needed.
"""

import base64
import hashlib
import hmac
import json
import time

import structlog
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request

from app.config import settings

logger = structlog.get_logger()

router = APIRouter()

# Svix rejects payloads older than this to blunt replay attacks.
_SVIX_TOLERANCE_SECONDS = 300


def _verify_svix(body: bytes, svix_id: str, svix_timestamp: str, svix_signature: str) -> bool:
    """Standard Svix scheme: HMAC-SHA256 over ``{id}.{timestamp}.{body}``.

    Hand-rolled against the documented scheme rather than pulling in the svix
    package for one endpoint. The header may carry several space-separated
    ``v1,<sig>`` entries during a secret rotation; any match is good.
    """
    secret = settings.RESEND_INBOUND_WEBHOOK_SECRET
    if not (secret and svix_id and svix_timestamp and svix_signature):
        return False

    try:
        if abs(time.time() - int(svix_timestamp)) > _SVIX_TOLERANCE_SECONDS:
            logger.warning("resend_webhook_stale_timestamp", ts=svix_timestamp)
            return False
    except (TypeError, ValueError):
        return False

    raw = secret.split("_", 1)[1] if secret.startswith("whsec_") else secret
    try:
        key = base64.b64decode(raw)
    except Exception:  # noqa: BLE001 — a malformed secret is a config error, not a request error
        logger.error("resend_webhook_bad_secret")
        return False

    signed = b"%s.%s.%s" % (svix_id.encode(), svix_timestamp.encode(), body)
    expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()

    for part in svix_signature.split():
        version, _, candidate = part.partition(",")
        if version == "v1" and hmac.compare_digest(candidate, expected):
            return True
    return False


def _notify_admin(sender: str, to: list, subject: str, email_id: str, received_for: list) -> None:
    """Best-effort admin notification. Never raises — a Resend outage must not
    make us return 5xx and trigger endless webhook retries."""
    recipients = [a.strip() for a in (settings.ADMIN_REPORT_RECIPIENTS or "").split(",") if a.strip()]
    if not recipients:
        logger.warning("resend_inbound_notify_skipped", reason="no ADMIN_REPORT_RECIPIENTS")
        return

    html = (
        "<h2>New mail received at govihublk.com</h2>"
        f"<p><b>From:</b> {sender}</p>"
        f"<p><b>To:</b> {', '.join(to) or '-'}</p>"
        f"<p><b>Delivered for:</b> {', '.join(received_for) or '-'}</p>"
        f"<p><b>Subject:</b> {subject}</p>"
        f"<p><b>Resend email id:</b> {email_id}</p>"
        "<p style='color:#666'>Body and attachments are not included in the webhook. "
        "Read the full message in the Resend dashboard, or via the Received Emails API "
        "using the id above.</p>"
    )
    try:
        from app.utils.email import EmailService

        EmailService().send_html(
            to=recipients,
            subject=f"[GoviHub inbox] {subject or '(no subject)'}",
            html_body=html,
        )
        logger.info("resend_inbound_notified", email_id=email_id, recipients=len(recipients))
    except Exception as exc:  # noqa: BLE001
        logger.error("resend_inbound_notify_failed", email_id=email_id, error=str(exc))


@router.post("/resend/inbound")
async def resend_inbound(
    request: Request,
    background_tasks: BackgroundTasks,
    svix_id: str = Header(None, alias="svix-id"),
    svix_timestamp: str = Header(None, alias="svix-timestamp"),
    svix_signature: str = Header(None, alias="svix-signature"),
):
    """Receive ``email.received`` from Resend and notify the admin address.

    Returns 200 fast and does the send in the background: Svix treats a slow
    response as a failure and retries.
    """
    body = await request.body()

    if not _verify_svix(body, svix_id, svix_timestamp, svix_signature):
        logger.warning("resend_webhook_rejected", reason="bad_signature")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        event = json.loads(body)
    except ValueError:
        raise HTTPException(status_code=400, detail="Malformed JSON")

    event_type = event.get("type")
    if event_type != "email.received":
        logger.info("resend_webhook_ignored", type=event_type)
        return {"status": "ignored", "type": event_type}

    data = event.get("data") or {}
    sender = (data.get("from") or "").strip()
    email_id = data.get("email_id") or "unknown"

    # Loop guard: our own outbound is from @govihublk.com. A bounce back to
    # reports@ would re-enter here and we would notify, bounce, notify forever.
    own_domain = (settings.RESEND_FROM_EMAIL or "").split("@")[-1].lower()
    if own_domain and sender.lower().endswith("@" + own_domain):
        logger.info("resend_inbound_self_mail_skipped", sender=sender, email_id=email_id)
        return {"status": "skipped_self", "email_id": email_id}

    logger.info(
        "resend_inbound_received",
        email_id=email_id,
        sender=sender,
        to=data.get("to"),
        subject=data.get("subject"),
    )
    background_tasks.add_task(
        _notify_admin,
        sender,
        data.get("to") or [],
        data.get("subject") or "",
        email_id,
        data.get("received_for") or [],
    )
    return {"status": "ok", "email_id": email_id}
