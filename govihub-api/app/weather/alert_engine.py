"""Weather Alert Engine — Background job to generate weather alerts for farmers."""

from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import select

from app.database import async_session_factory
from app.dependencies import get_redis
from app.weather.crop_profiles import CROP_WEATHER_PROFILES
from app.weather.models import FarmerCropSelection, WeatherAlert
from app.weather.service import (
    DISTRICT_COORDS,
    evaluate_crop_alerts,
    fetch_forecast,
    format_forecast_response,
    resolve_location,
)

logger = structlog.get_logger()


async def generate_alerts_for_all_farmers() -> int:
    """
    Generate weather alerts for all farmers who have crop selections.
    Groups farmers by district to minimize API calls (one fetch per location).
    Returns count of new alerts created.
    """
    redis = await get_redis()
    new_count = 0

    async with async_session_factory() as db:
        # Get all farmers with crop selections, grouped by user
        result = await db.execute(
            select(FarmerCropSelection).order_by(FarmerCropSelection.user_id)
        )
        all_selections = result.scalars().all()

        if not all_selections:
            return 0

        # Group selections by user_id
        user_crops: dict[str, list] = {}
        for sel in all_selections:
            uid = str(sel.user_id)
            if uid not in user_crops:
                user_crops[uid] = []
            user_crops[uid].append(sel)

        # Get user districts for location resolution
        from app.users.models import User

        user_ids = list(user_crops.keys())
        users_result = await db.execute(
            select(User).where(User.id.in_(user_ids))
        )
        users = {str(u.id): u for u in users_result.scalars().all()}

        # Cache forecasts by district to avoid duplicate fetches
        forecast_cache: dict[str, dict] = {}

        for uid, selections in user_crops.items():
            user = users.get(uid)
            if not user:
                continue

            # Resolve location
            lat, lng, location_name = resolve_location(None, None, user)
            cache_key = f"{round(lat, 2)}:{round(lng, 2)}"

            # Fetch forecast (cached per location)
            if cache_key not in forecast_cache:
                try:
                    raw = await fetch_forecast(lat, lng, redis, days=7)
                    forecast_cache[cache_key] = format_forecast_response(raw, location_name)
                except Exception as e:
                    logger.error("alert_forecast_error", user_id=uid, error=str(e))
                    continue

            forecast = forecast_cache[cache_key]
            crop_types = [s.crop_type for s in selections]
            growth_stages = {s.crop_type: s.growth_stage for s in selections if s.growth_stage}

            # Evaluate alerts
            alerts = evaluate_crop_alerts(forecast, crop_types, growth_stages)

            # Store new alerts (deduplicate)
            for alert in alerts:
                if alert.get("severity") == "good":
                    continue  # Don't store "good" status alerts

                forecast_date = alert.get("date")
                if not forecast_date:
                    continue

                try:
                    from datetime import date as date_type
                    fd = date_type.fromisoformat(forecast_date)
                except Exception:
                    continue

                # Check if alert already exists
                existing = await db.execute(
                    select(WeatherAlert).where(
                        WeatherAlert.user_id == user.id,
                        WeatherAlert.crop_type == alert["crop"],
                        WeatherAlert.alert_type == alert["type"],
                        WeatherAlert.forecast_date == fd,
                    )
                )
                if existing.scalar_one_or_none():
                    continue

                # Create new alert
                new_alert = WeatherAlert(
                    user_id=user.id,
                    crop_type=alert["crop"],
                    alert_type=alert["type"],
                    severity=alert.get("severity", "info"),
                    forecast_date=fd,
                    message_si=alert.get("message_si", alert.get("message_en", "")),
                    message_en=alert.get("message_en"),
                    weather_data={
                        "icon": alert.get("icon"),
                        "date": forecast_date,
                    },
                    expires_at=datetime.now(timezone.utc) + timedelta(days=3),
                )
                db.add(new_alert)
                new_count += 1

        await db.commit()

    logger.info("weather_alerts_generated", new_alerts=new_count, farmers=len(user_crops))
    return new_count
