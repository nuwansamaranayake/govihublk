"""Weather Router — /api/v1/weather endpoints."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from redis.asyncio import Redis
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_redis, require_complete_profile
from app.weather.service import (
    evaluate_crop_alerts,
    fetch_forecast,
    format_forecast_response,
    format_hourly_for_date,
    resolve_location,
    _closest_district,
)
from app.weather.crop_profiles import CROP_WEATHER_PROFILES, get_all_crop_types

logger = structlog.get_logger()

router = APIRouter()


@router.get("/forecast", summary="Get weather forecast for farmer's location")
async def get_weather_forecast(
    lat: Optional[float] = Query(None, description="Latitude"),
    lng: Optional[float] = Query(None, description="Longitude"),
    days: int = Query(7, ge=1, le=16, description="Number of forecast days"),
    current_user=Depends(require_complete_profile),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns weather forecast with current conditions, daily summaries, hourly detail,
    soil conditions, and crop-specific advisories.
    """
    resolved_lat, resolved_lng, location_name = resolve_location(lat, lng, current_user)

    try:
        raw = await fetch_forecast(resolved_lat, resolved_lng, redis, days=days)
    except Exception as e:
        logger.error("weather_fetch_error", error=str(e))
        raise HTTPException(status_code=502, detail="Weather data unavailable. Please try again later.")

    result = format_forecast_response(raw, location_name)

    # Get farmer's crop selections for personalized alerts
    crop_types = None
    growth_stages = {}
    if hasattr(current_user, "role") and current_user.role and current_user.role.value == "farmer":
        from app.weather.models import FarmerCropSelection
        selections_result = await db.execute(
            select(FarmerCropSelection).where(FarmerCropSelection.user_id == current_user.id)
        )
        selections = selections_result.scalars().all()
        if selections:
            crop_types = [s.crop_type for s in selections]
            growth_stages = {s.crop_type: s.growth_stage for s in selections if s.growth_stage}

    result["crop_alerts"] = evaluate_crop_alerts(result, crop_types, growth_stages)

    return result


@router.get("/forecast/public", summary="Get weather forecast (no auth)")
async def get_weather_forecast_public(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    days: int = Query(7, ge=1, le=16),
    redis: Redis = Depends(get_redis),
):
    """Public endpoint for weather forecast — requires explicit coordinates."""
    try:
        raw = await fetch_forecast(lat, lng, redis, days=days)
    except Exception as e:
        logger.error("weather_fetch_error", error=str(e))
        raise HTTPException(status_code=502, detail="Weather data unavailable.")

    location_name = _closest_district(lat, lng)
    return format_forecast_response(raw, location_name)


@router.get("/forecast/{date}", summary="Get hourly detail for a specific date")
async def get_hourly_by_date(
    date: str,
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    current_user=Depends(require_complete_profile),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
):
    """Returns hourly weather data for a specific date with soil conditions and crop notes."""
    resolved_lat, resolved_lng, location_name = resolve_location(lat, lng, current_user)

    try:
        raw = await fetch_forecast(resolved_lat, resolved_lng, redis, days=16)
    except Exception as e:
        logger.error("weather_fetch_error", error=str(e))
        raise HTTPException(status_code=502, detail="Weather data unavailable.")

    result = format_hourly_for_date(raw, date, location_name)

    # Add crop notes if farmer
    crop_notes = []
    if hasattr(current_user, "role") and current_user.role and current_user.role.value == "farmer":
        from app.weather.models import FarmerCropSelection
        selections_result = await db.execute(
            select(FarmerCropSelection).where(FarmerCropSelection.user_id == current_user.id)
        )
        selections = selections_result.scalars().all()
        for s in selections:
            profile = CROP_WEATHER_PROFILES.get(s.crop_type, {})
            soil_cond = result.get("soil_conditions", {})
            soil_temp = soil_cond.get("current_soil_temp_6cm")

            # Generate crop-specific notes based on soil conditions
            note_si = ""
            note_en = ""
            if soil_temp is not None:
                optimal_min = profile.get("soil_temp_optimal_min")
                optimal_max = profile.get("soil_temp_optimal_max")
                if optimal_min and optimal_max and optimal_min <= soil_temp <= optimal_max:
                    note_si = f"පස් උෂ්ණත්වය {soil_temp}°C — {profile['name_si']}වලට ප්‍රශස්ත"
                    note_en = f"Soil temp {soil_temp}°C — optimal for {profile['name_en']}"
                elif profile.get("soil_temp_critical_low") and soil_temp < profile["soil_temp_critical_low"]:
                    note_si = f"පස් උෂ්ණත්වය {soil_temp}°C — {profile['name_si']}වලට ඉතා සීතල"
                    note_en = f"Soil temp {soil_temp}°C — too cold for {profile['name_en']}"

            if not note_si:
                note_si = f"ඉදිරි දිනය {profile['name_si']}වලට සුදුසුයි"
                note_en = f"Conditions suitable for {profile['name_en']}"

            crop_notes.append({
                "crop_type": s.crop_type,
                "name_si": profile.get("name_si", s.crop_type),
                "note_si": note_si,
                "note_en": note_en,
            })

    result["crop_notes"] = crop_notes
    return result


@router.get("/alerts", summary="Get farmer's weather alerts")
async def get_weather_alerts(
    unread_only: bool = Query(False),
    current_user=Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Return active (non-expired) weather alerts for the current farmer."""
    from app.weather.models import WeatherAlert

    query = (
        select(WeatherAlert)
        .where(
            WeatherAlert.user_id == current_user.id,
            WeatherAlert.expires_at > datetime.now(timezone.utc),
        )
        .order_by(WeatherAlert.created_at.desc())
    )
    if unread_only:
        query = query.where(WeatherAlert.is_read == False)

    result = await db.execute(query)
    alerts_list = result.scalars().all()

    # Count unread
    unread_result = await db.execute(
        select(WeatherAlert)
        .where(
            WeatherAlert.user_id == current_user.id,
            WeatherAlert.is_read == False,
            WeatherAlert.expires_at > datetime.now(timezone.utc),
        )
    )
    unread_count = len(unread_result.scalars().all())

    return {
        "alerts": [
            {
                "id": str(a.id),
                "crop_type": a.crop_type,
                "crop_name_si": CROP_WEATHER_PROFILES.get(a.crop_type, {}).get("name_si", a.crop_type),
                "alert_type": a.alert_type,
                "severity": a.severity,
                "forecast_date": a.forecast_date.isoformat(),
                "message_si": a.message_si,
                "message_en": a.message_en,
                "is_read": a.is_read,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "weather_data": a.weather_data,
            }
            for a in alerts_list
        ],
        "unread_count": unread_count,
        "total": len(alerts_list),
    }


@router.get("/alerts/unread-count", summary="Get unread alert count")
async def get_unread_alert_count(
    current_user=Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Return just the unread count — used by bell icon badge."""
    from app.weather.models import WeatherAlert

    result = await db.execute(
        select(WeatherAlert)
        .where(
            WeatherAlert.user_id == current_user.id,
            WeatherAlert.is_read == False,
            WeatherAlert.expires_at > datetime.now(timezone.utc),
        )
    )
    count = len(result.scalars().all())
    return {"unread_count": count}


@router.put("/alerts/{alert_id}/read", summary="Mark alert as read")
async def mark_alert_read(
    alert_id: str,
    current_user=Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Mark a single weather alert as read."""
    from app.weather.models import WeatherAlert

    result = await db.execute(
        select(WeatherAlert).where(
            WeatherAlert.id == alert_id,
            WeatherAlert.user_id == current_user.id,
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_read = True
    await db.flush()
    return {"message": "Alert marked as read"}


@router.put("/alerts/read-all", summary="Mark all alerts as read")
async def mark_all_alerts_read(
    current_user=Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Mark all of farmer's weather alerts as read."""
    from app.weather.models import WeatherAlert

    result = await db.execute(
        update(WeatherAlert)
        .where(
            WeatherAlert.user_id == current_user.id,
            WeatherAlert.is_read == False,
        )
        .values(is_read=True)
    )
    return {"message": "All alerts marked as read", "count": result.rowcount}


@router.get("/crop-profiles", summary="List all crop weather profiles")
async def list_crop_profiles(
    _user=Depends(require_complete_profile),
):
    """Return all available crop weather profiles for UI display."""
    profiles = []
    for key, profile in CROP_WEATHER_PROFILES.items():
        profiles.append({
            "crop_type": key,
            "name_si": profile["name_si"],
            "name_en": profile["name_en"],
            "optimal_temp_min": profile["optimal_temp_min"],
            "optimal_temp_max": profile["optimal_temp_max"],
            "critical_temp_low": profile.get("critical_temp_low"),
            "critical_temp_high": profile.get("critical_temp_high"),
            "wind_sensitive": profile.get("wind_sensitive", False),
            "waterlog_sensitive": profile.get("waterlog_sensitive", False),
        })
    return profiles
