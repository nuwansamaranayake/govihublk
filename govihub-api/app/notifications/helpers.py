"""GoviHub Notification Helpers — Convenience functions for common notification events."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, Optional
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.notifications.models import NotificationType
from app.notifications.service import NotificationService

if TYPE_CHECKING:
    from app.matching.models import Match
    from app.users.models import User

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Match notifications
# ---------------------------------------------------------------------------


async def notify_match_found(
    db: AsyncSession,
    match: "Match",
    farmer: "User",
    buyer: "User",
) -> None:
    """Notify both farmer and buyer that a new match has been proposed.

    Sends an ``in_app`` + ``push`` notification to each party with
    match-specific payload data.
    """
    svc = NotificationService(db)

    match_data: Dict[str, Any] = {
        "match_id": str(match.id),
        "harvest_id": str(match.harvest_id),
        "demand_id": str(match.demand_id),
        "score": round(match.score, 3),
    }

    # Notify farmer
    try:
        await svc.send_notification(
            user_id=farmer.id,
            type=NotificationType.match_found,
            title="New Match Found",
            body=(
                f"A buyer has been matched to your harvest listing. "
                f"Match score: {round(match.score * 100)}%"
            ),
            data={**match_data, "role": "farmer"},
        )
    except Exception as exc:
        logger.warning("notify_match_found_farmer_error", error=str(exc))

    # Notify buyer
    try:
        await svc.send_notification(
            user_id=buyer.id,
            type=NotificationType.match_found,
            title="New Match Found",
            body=(
                f"A farmer has been matched to your demand posting. "
                f"Match score: {round(match.score * 100)}%"
            ),
            data={**match_data, "role": "buyer"},
        )
    except Exception as exc:
        logger.warning("notify_match_found_buyer_error", error=str(exc))


async def notify_match_accepted(
    db: AsyncSession,
    match: "Match",
    accepting_user: "User",
    other_user: "User",
) -> None:
    """Notify the other party that the match has been accepted.

    Only notifies ``other_user``; the accepting user triggered the action
    themselves and does not need a notification.
    """
    svc = NotificationService(db)

    match_data: Dict[str, Any] = {
        "match_id": str(match.id),
        "harvest_id": str(match.harvest_id),
        "demand_id": str(match.demand_id),
        "status": match.status.value,
        "accepted_by": str(accepting_user.id),
    }

    accepting_name = accepting_user.name or "The other party"

    try:
        await svc.send_notification(
            user_id=other_user.id,
            type=NotificationType.match_accepted,
            title="Match Accepted",
            body=f"{accepting_name} has accepted the match. Review and confirm to proceed.",
            data=match_data,
        )
    except Exception as exc:
        logger.warning("notify_match_accepted_error", error=str(exc))


# ---------------------------------------------------------------------------
# Alert notifications
# ---------------------------------------------------------------------------


async def notify_weather_alert(
    db: AsyncSession,
    user_id: UUID,
    alert_type: str,
    details: str,
) -> None:
    """Send a weather alert notification to a single user.

    Weather alerts are marked as critical and bypass quiet hours.

    Args:
        db: Async database session.
        user_id: Target user's UUID.
        alert_type: Short alert category (e.g. ``"heavy_rain"``, ``"frost"``).
        details: Human-readable description of the alert.
    """
    svc = NotificationService(db)

    alert_titles: Dict[str, str] = {
        "heavy_rain": "Heavy Rain Warning",
        "flood": "Flood Alert",
        "drought": "Drought Warning",
        "frost": "Frost Warning",
        "high_wind": "High Wind Advisory",
        "heat_wave": "Heat Wave Warning",
    }
    title = alert_titles.get(alert_type, "Weather Alert")

    try:
        await svc.send_notification(
            user_id=user_id,
            type=NotificationType.weather_alert,
            title=title,
            body=details,
            data={"alert_type": alert_type, "details": details},
        )
    except Exception as exc:
        logger.warning(
            "notify_weather_alert_error",
            user_id=str(user_id),
            alert_type=alert_type,
            error=str(exc),
        )


async def notify_price_alert(
    db: AsyncSession,
    user_id: UUID,
    crop_name: str,
    price_change: float,
) -> None:
    """Send a price alert notification when a crop price changes significantly.

    Args:
        db: Async database session.
        user_id: Target user's UUID.
        crop_name: Display name of the crop (e.g. ``"Tomato"``).
        price_change: Percentage change (positive = increase, negative = decrease).
    """
    svc = NotificationService(db)

    direction = "increased" if price_change >= 0 else "decreased"
    abs_change = abs(price_change)

    try:
        await svc.send_notification(
            user_id=user_id,
            type=NotificationType.price_alert,
            title=f"Price Alert: {crop_name}",
            body=(
                f"Market price for {crop_name} has {direction} by "
                f"{abs_change:.1f}%. Check the latest listings."
            ),
            data={
                "crop_name": crop_name,
                "price_change_pct": price_change,
                "direction": direction,
            },
        )
    except Exception as exc:
        logger.warning(
            "notify_price_alert_error",
            user_id=str(user_id),
            crop_name=crop_name,
            error=str(exc),
        )
