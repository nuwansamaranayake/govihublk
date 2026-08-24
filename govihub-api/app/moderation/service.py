"""GoviHub Moderation Service — AI text/image scanning and the shared unpublish path.

Design rules that must not be quietly relaxed:

1. FAIL OPEN. Any AI or network exception writes an `error` event, leaves the
   listing live and `pending_scan`, and lets the sweep retry. A scanner outage
   must never unpublish a farmer or block a publish.
2. ONE unpublish path. `unpublish_listing` is the only function that takes a
   listing down. The auto-flag path and the admin manual-flag action both call
   it, so the status change, the audit row, and the admin email can never drift
   apart.
3. Ordinary agricultural trade talk is NOT a violation. Prices, quantities,
   districts, and a phone number in the listing body are exactly what a real
   listing looks like. The prompt says so explicitly — a false positive on a
   genuine farmer costs far more than a missed scam.
"""

from __future__ import annotations

import base64
import json
from typing import Optional
from uuid import UUID

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.listings.models import HarvestListing, HarvestStatus
from app.marketplace.models import SupplyListing, SupplyStatus
from app.moderation.models import (
    LISTING_TYPES,
    STATUS_CLEAN,
    STATUS_FLAGGED,
    STATUS_PENDING,
    STATUS_REVIEWED,
    ModerationEvent,
)
from app.utils.openrouter import OpenRouterClient

logger = structlog.get_logger()

VERDICT_CLEAN = "clean"
VERDICT_FLAGGED = "flagged"
VERDICT_ERROR = "error"

# Gemini 2.0 Flash via OpenRouter — same model the crop-diagnosis path uses.
VISION_MODEL = "google/gemini-2.0-flash-001"


TEXT_SYSTEM_PROMPT = """You are a content moderator for GoviHub, an agricultural \
marketplace in Sri Lanka where farmers and suppliers list crops, harvests, seeds, \
fertilizer, and farm equipment.

Flag a listing ONLY if it contains one of these:
- scam: fake offers, advance-fee fraud, impossible guarantees, money-doubling, \
crypto/investment schemes, requests to wire money before delivery.
- contact-bait: pushing the deal off-platform, e.g. "don't use GoviHub", \
"pay outside the app", "WhatsApp me instead so we skip the platform fee".
- abusive content: harassment, hate speech, threats, sexual content.
- illegal goods: drugs, weapons, wildlife, banned or smuggled agrochemicals.

CRITICAL — the following are NORMAL and must be marked clean:
- Prices, quantities, weights, units, and haggling ("Rs 2500/kg", "50kg available").
- A phone number, WhatsApp number, or address in the listing body. Sri Lankan \
farmers routinely publish their phone so buyers can reach them. A phone number \
alone is NEVER contact-bait. It is only contact-bait when the text also pushes \
the buyer to avoid the platform.
- Sinhala, Tamil, or English text, or any mix of them.
- Crop names, varieties, grades, harvest dates, districts, delivery terms.
- Ordinary spelling mistakes, ALL CAPS, or terse phrasing.

When in doubt, return clean. A false positive removes a real farmer's income.

Respond with ONLY a JSON object, no prose and no markdown fences:
{"verdict":"clean"|"flagged","categories":[],"reason":"one short sentence"}"""


IMAGE_SYSTEM_PROMPT = """You are a content moderator for GoviHub, an agricultural \
marketplace in Sri Lanka. You are shown photos attached to a crop, harvest, or \
farm-supply listing.

Flag the images ONLY if they contain:
- nudity: sexual or pornographic content.
- violence: gore, injury, animal cruelty, weapons used against people.
- non-agricultural scam imagery: stock photos of cash, gift cards, crypto, \
QR codes to payment sites, or images unrelated to the product being sold and \
clearly used to bait a transaction.

CRITICAL — the following are NORMAL and must be marked clean:
- Crops, produce, seeds, sacks, soil, fields, paddy, spices, vegetables, fruit.
- Diseased, rotting, insect-damaged, or discoloured plants. Plant disease is \
not gore.
- Livestock, poultry, fish, and normal farm butchery or market stalls.
- Tractors, sprayers, tools, fertilizer bags, greenhouses, irrigation gear.
- Farmers in the photo, blurry phone photos, screenshots of a scale or receipt.

When in doubt, return clean.

Respond with ONLY a JSON object, no prose and no markdown fences:
{"verdict":"clean"|"flagged","categories":[],"reason":"one short sentence"}"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _assert_listing_type(listing_type: str) -> None:
    if listing_type not in LISTING_TYPES:
        raise ValueError(f"listing_type must be one of {LISTING_TYPES}, got {listing_type!r}")


def _parse_verdict(raw: str) -> dict:
    """Parse the strict-JSON verdict, defensively.

    Models wrap JSON in ```json fences, prepend a sentence, or add trailing
    prose no matter how firmly the prompt says not to. Strip fences, then fall
    back to the outermost {...} span. Raises ValueError when nothing parses —
    the caller turns that into a fail-open `error` event.
    """
    text = (raw or "").strip()

    if text.startswith("```"):
        # Drop the opening fence line (```json or ```) and any closing fence.
        text = text.split("\n", 1)[1] if "\n" in text else ""
        if "```" in text:
            text = text.rsplit("```", 1)[0]
        text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise ValueError(f"no JSON object in model response: {raw[:200]!r}")
        data = json.loads(text[start : end + 1])

    if not isinstance(data, dict):
        raise ValueError(f"model response was not a JSON object: {raw[:200]!r}")

    verdict = str(data.get("verdict", "")).strip().lower()
    if verdict not in (VERDICT_CLEAN, VERDICT_FLAGGED):
        raise ValueError(f"unrecognised verdict {verdict!r} in {raw[:200]!r}")

    categories = data.get("categories") or []
    if not isinstance(categories, list):
        categories = [str(categories)]

    return {
        "verdict": verdict,
        "categories": [str(c) for c in categories],
        "reason": str(data.get("reason") or "").strip(),
    }


def _describe(parsed: dict) -> str:
    cats = ", ".join(parsed["categories"]) if parsed["categories"] else "none"
    return f"[{cats}] {parsed['reason']}".strip()


async def record_event(
    db: AsyncSession,
    listing_type: str,
    listing_id: UUID,
    kind: str,
    verdict: str,
    model: Optional[str] = None,
    reason: Optional[str] = None,
) -> ModerationEvent:
    """Write one audit row. Every scan outcome lands here, including errors."""
    event = ModerationEvent(
        listing_type=listing_type,
        listing_id=listing_id,
        kind=kind,
        verdict=verdict,
        model=model,
        reason=(reason or "")[:4000] or None,
    )
    db.add(event)
    await db.flush()
    return event


async def _load_listing(db: AsyncSession, listing_type: str, listing_id: UUID):
    _assert_listing_type(listing_type)
    model = SupplyListing if listing_type == "supply" else HarvestListing
    result = await db.execute(select(model).where(model.id == listing_id))
    return result.scalar_one_or_none()


def _admin_recipients() -> list[str]:
    raw = settings.ADMIN_REPORT_RECIPIENTS or ""
    return [addr.strip() for addr in raw.split(",") if addr.strip()]


def _send_admin_email(subject: str, html_body: str) -> None:
    """Best-effort admin notification.

    Deliberately swallows every exception. Email is a notification channel, not
    a gate: a missing RESEND_API_KEY or a Resend outage must never roll back an
    unpublish or crash the sweep.
    """
    recipients = _admin_recipients()
    if not recipients:
        logger.warning("moderation_email_skipped", reason="no ADMIN_REPORT_RECIPIENTS")
        return
    try:
        from app.utils.email import EmailService

        EmailService().send_html(to=recipients, subject=subject, html_body=html_body)
        logger.info("moderation_email_sent", subject=subject, recipients=len(recipients))
    except Exception as exc:  # noqa: BLE001
        logger.error("moderation_email_failed", subject=subject, error=str(exc))


# ---------------------------------------------------------------------------
# Scanners
# ---------------------------------------------------------------------------

async def scan_text(
    db: AsyncSession,
    listing_type: str,
    listing_id: UUID,
    text: str,
) -> str:
    """Scan listing text via OpenRouter. Returns 'clean' | 'flagged' | 'error'.

    Never raises. On any failure it records an `error` event and returns
    'error', which the caller treats as fail-open.
    """
    _assert_listing_type(listing_type)

    if not (text or "").strip():
        await record_event(db, listing_type, listing_id, "text", VERDICT_CLEAN, reason="empty text, nothing to scan")
        return VERDICT_CLEAN

    if not settings.OPENROUTER_API_KEY:
        await record_event(
            db, listing_type, listing_id, "text", VERDICT_ERROR,
            reason="OPENROUTER_API_KEY not configured — scan skipped, listing left live",
        )
        return VERDICT_ERROR

    try:
        client = OpenRouterClient()
        response = await client.chat(
            messages=[{"role": "user", "content": f"Listing text:\n---\n{text[:6000]}\n---"}],
            system=TEXT_SYSTEM_PROMPT,
            max_tokens=300,
            temperature=0.0,
        )
        parsed = _parse_verdict(response.content)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "moderation_text_scan_failed",
            listing_type=listing_type, listing_id=str(listing_id), error=str(exc),
        )
        await record_event(
            db, listing_type, listing_id, "text", VERDICT_ERROR,
            model=settings.OPENROUTER_MODEL, reason=f"scan error: {exc}",
        )
        return VERDICT_ERROR

    await record_event(
        db, listing_type, listing_id, "text", parsed["verdict"],
        model=response.model, reason=_describe(parsed),
    )
    if parsed["verdict"] == VERDICT_FLAGGED:
        await unpublish_listing(db, listing_type, listing_id, _describe(parsed))
    return parsed["verdict"]


async def scan_images(
    db: AsyncSession,
    listing_type: str,
    listing_id: UUID,
    urls: list[str],
) -> str:
    """Scan listing images via Gemini Flash Vision. Same fail-open contract as scan_text."""
    _assert_listing_type(listing_type)

    urls = [u for u in (urls or []) if u]
    if not urls:
        await record_event(db, listing_type, listing_id, "image", VERDICT_CLEAN, reason="no images on listing")
        return VERDICT_CLEAN

    if not settings.OPENROUTER_API_KEY:
        await record_event(
            db, listing_type, listing_id, "image", VERDICT_ERROR,
            reason="OPENROUTER_API_KEY not configured — scan skipped, listing left live",
        )
        return VERDICT_ERROR

    try:
        content = [{"type": "text", "text": "Moderate the attached listing photos."}]
        for url in urls[:4]:  # cap: 4 photos is plenty of signal per listing
            content.append({"type": "image_url", "image_url": {"url": await _image_url_for_model(url)}})

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": settings.APP_URL,
                    "X-Title": settings.APP_NAME,
                },
                json={
                    "model": VISION_MODEL,
                    "messages": [
                        {"role": "system", "content": IMAGE_SYSTEM_PROMPT},
                        {"role": "user", "content": content},
                    ],
                    "max_tokens": 300,
                    "temperature": 0.0,
                },
            )
            response.raise_for_status()
            data = response.json()

        parsed = _parse_verdict(data["choices"][0]["message"]["content"])
        used_model = data.get("model", VISION_MODEL)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "moderation_image_scan_failed",
            listing_type=listing_type, listing_id=str(listing_id), error=str(exc),
        )
        await record_event(
            db, listing_type, listing_id, "image", VERDICT_ERROR,
            model=VISION_MODEL, reason=f"scan error: {exc}",
        )
        return VERDICT_ERROR

    await record_event(
        db, listing_type, listing_id, "image", parsed["verdict"],
        model=used_model, reason=_describe(parsed),
    )
    if parsed["verdict"] == VERDICT_FLAGGED:
        await unpublish_listing(db, listing_type, listing_id, _describe(parsed))
    return parsed["verdict"]


async def _image_url_for_model(url: str) -> str:
    """Return a URL the vision model can read.

    Remote http(s) URLs pass through. Local upload paths (`/uploads/...`) are
    read off disk and inlined as a data URI, because the model cannot reach a
    private container filesystem.
    """
    if url.startswith("http://") or url.startswith("https://"):
        return url

    from pathlib import Path

    # Local-storage fallback: main.py mounts /app/uploads at /uploads/.
    path = Path("/app/uploads") / url.lstrip("/").removeprefix("uploads/")
    raw = path.read_bytes()
    if raw[:4] == b"\x89PNG":
        media_type = "image/png"
    else:
        media_type = "image/jpeg"
    return f"data:{media_type};base64,{base64.b64encode(raw).decode('utf-8')}"


# ---------------------------------------------------------------------------
# State transitions — the one shared unpublish path
# ---------------------------------------------------------------------------

async def unpublish_listing(
    db: AsyncSession,
    listing_type: str,
    listing_id: UUID,
    reason: str,
) -> bool:
    """Take a listing down. THE shared path for auto-flag and admin manual flag.

    Sets supply -> discontinued, harvest -> cancelled, marks moderation_status
    'flagged', writes an audit row, and emails the admins. Returns False when
    the listing no longer exists.
    """
    listing = await _load_listing(db, listing_type, listing_id)
    if listing is None:
        logger.warning("moderation_unpublish_missing", listing_type=listing_type, listing_id=str(listing_id))
        return False

    if listing_type == "supply":
        listing.status = SupplyStatus.discontinued
        owner_id = listing.supplier_id
        label = listing.name
    else:
        listing.status = HarvestStatus.cancelled
        owner_id = listing.farmer_id
        label = f"Harvest {listing.variety or ''}".strip()

    listing.moderation_status = STATUS_FLAGGED
    listing.removal_reason = reason
    await db.flush()

    await record_event(
        db, listing_type, listing_id, "text", VERDICT_FLAGGED,
        reason=f"unpublished: {reason}",
    )

    logger.info(
        "moderation_unpublished",
        listing_type=listing_type, listing_id=str(listing_id), reason=reason,
    )

    _send_admin_email(
        subject=f"[GoviHub] Listing unpublished — {listing_type} {listing_id}",
        html_body=(
            "<h3>A listing was unpublished by moderation</h3>"
            f"<p><b>Type:</b> {listing_type}<br>"
            f"<b>Listing ID:</b> {listing_id}<br>"
            f"<b>Title:</b> {label}<br>"
            f"<b>Owner user ID:</b> {owner_id}</p>"
            f"<p><b>Reason:</b> {reason}</p>"
            "<p>Review it in the admin panel under flagged listings. "
            "Approving it republishes the listing.</p>"
        ),
    )
    return True


async def approve_listing(db: AsyncSession, listing_type: str, listing_id: UUID) -> bool:
    """Republish a listing an admin cleared. supply -> active, harvest -> ready."""
    listing = await _load_listing(db, listing_type, listing_id)
    if listing is None:
        logger.warning("moderation_approve_missing", listing_type=listing_type, listing_id=str(listing_id))
        return False

    if listing_type == "supply":
        listing.status = SupplyStatus.active
    else:
        listing.status = HarvestStatus.ready

    listing.moderation_status = STATUS_REVIEWED
    listing.removal_reason = None
    await db.flush()

    await record_event(
        db, listing_type, listing_id, "text", VERDICT_CLEAN,
        reason="admin approved — listing republished",
    )
    logger.info("moderation_approved", listing_type=listing_type, listing_id=str(listing_id))
    return True


async def notify_first_listing(
    db: AsyncSession,
    user,
    listing_type: str,
    listing_id: UUID,
) -> None:
    """Tell admins a brand-new account just published its first listing.

    The listing stays live. This is a heads-up for human eyes, not a gate.
    """
    _assert_listing_type(listing_type)

    await record_event(
        db, listing_type, listing_id, "text", VERDICT_CLEAN,
        reason=f"first listing from new account {user.id}",
    )
    logger.info(
        "moderation_first_listing",
        user_id=str(user.id), listing_type=listing_type, listing_id=str(listing_id),
    )

    _send_admin_email(
        subject=f"[GoviHub] First listing from a new account — {getattr(user, 'name', '') or user.id}",
        html_body=(
            "<h3>A new account published its first listing</h3>"
            f"<p><b>User:</b> {getattr(user, 'name', '') or '(no name)'} "
            f"({getattr(user, 'phone', '') or getattr(user, 'email', '') or 'no contact'})<br>"
            f"<b>User ID:</b> {user.id}<br>"
            f"<b>Role:</b> {getattr(user, 'role', '')}</p>"
            f"<p><b>Listing:</b> {listing_type} {listing_id}</p>"
            "<p>The listing is live. This is a heads-up only — no action needed "
            "unless it looks wrong.</p>"
        ),
    )


async def count_user_listings(db: AsyncSession, user_id: UUID) -> int:
    """Total listings this user owns across BOTH tables."""
    from sqlalchemy import func

    supply = await db.execute(
        select(func.count()).select_from(SupplyListing).where(SupplyListing.supplier_id == user_id)
    )
    harvest = await db.execute(
        select(func.count()).select_from(HarvestListing).where(HarvestListing.farmer_id == user_id)
    )
    return (supply.scalar() or 0) + (harvest.scalar() or 0)


# ---------------------------------------------------------------------------
# Full scan of one listing (used by the sweep and by the publish-time hook)
# ---------------------------------------------------------------------------

def listing_text_blob(listing, listing_type: str) -> str:
    """Concatenate the free-text fields a scam would hide in."""
    if listing_type == "supply":
        parts = [listing.name, listing.name_si, listing.description]
    else:
        parts = [listing.variety, listing.description, listing.quality_grade]
    return "\n".join(p for p in parts if p)


def listing_image_urls(listing) -> list[str]:
    """Images are stored as JSONB `{"urls": [...]}` on both tables."""
    raw = listing.images
    if isinstance(raw, dict):
        urls = raw.get("urls") or []
    elif isinstance(raw, list):
        urls = raw
    else:
        urls = []
    return [str(u) for u in urls if u]


async def scan_listing(db: AsyncSession, listing_type: str, listing_id: UUID) -> str:
    """Run text then image scan on one listing and settle its moderation_status.

    Returns the overall verdict. Fail-open: an 'error' from either scanner
    leaves the listing live and `pending_scan` so the sweep retries it.
    """
    listing = await _load_listing(db, listing_type, listing_id)
    if listing is None:
        logger.warning(
            "moderation_scan_listing_missing",
            listing_type=listing_type, listing_id=str(listing_id),
        )
        return VERDICT_ERROR

    text_verdict = await scan_text(
        db, listing_type, listing_id, listing_text_blob(listing, listing_type)
    )
    if text_verdict == VERDICT_FLAGGED:
        return VERDICT_FLAGGED

    image_verdict = await scan_images(db, listing_type, listing_id, listing_image_urls(listing))
    if image_verdict == VERDICT_FLAGGED:
        return VERDICT_FLAGGED

    if VERDICT_ERROR in (text_verdict, image_verdict):
        # Leave moderation_status at pending_scan so the sweep picks it up again.
        logger.warning(
            "moderation_scan_incomplete",
            listing_type=listing_type, listing_id=str(listing_id),
            text=text_verdict, image=image_verdict,
        )
        return VERDICT_ERROR

    await db.refresh(listing)
    listing.moderation_status = STATUS_CLEAN
    await db.flush()
    return VERDICT_CLEAN


async def scan_listing_standalone(listing_type: str, listing_id: UUID) -> None:
    """Entry point for FastAPI BackgroundTasks. Opens its own session.

    IMPORTANT — the calling route MUST `await db.commit()` before scheduling
    this task. Measured on this stack (FastAPI 0.136 / Starlette 1.0), the
    `get_db` dependency's teardown commit runs AFTER background tasks, so a row
    written but not yet committed is invisible to this task's fresh session.
    Waiting it out is impossible: the commit is blocked until this task returns.

    The short poll below is only insurance for ordering jitter. If the row never
    appears the listing stays `pending_scan` and the 600s sweep picks it up.
    Fail open, never block.
    """
    import asyncio

    from app.database import async_session_factory

    try:
        for _attempt in range(3):
            async with async_session_factory() as db:
                if await _load_listing(db, listing_type, listing_id) is not None:
                    await scan_listing(db, listing_type, listing_id)
                    await db.commit()
                    return
            await asyncio.sleep(0.3)

        logger.warning(
            "moderation_background_scan_deferred",
            listing_type=listing_type, listing_id=str(listing_id),
            note="row not visible — did the route commit before scheduling? sweep will retry",
        )
    except Exception as exc:  # noqa: BLE001
        # Fail open, loudly. The listing stays live and pending_scan; the
        # 600s sweep will retry it.
        logger.error(
            "moderation_background_scan_failed",
            listing_type=listing_type, listing_id=str(listing_id), error=str(exc),
        )


async def notify_first_listing_standalone(user_id: UUID, listing_type: str, listing_id: UUID) -> None:
    """BackgroundTasks entry point for the first-listing notification."""
    from app.database import async_session_factory
    from app.users.models import User

    try:
        async with async_session_factory() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user is None:
                return
            await notify_first_listing(db, user, listing_type, listing_id)
            await db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "moderation_first_listing_notify_failed",
            user_id=str(user_id), error=str(exc),
        )
