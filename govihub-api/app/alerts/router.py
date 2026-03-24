"""GoviHub Alerts Router — Weather forecast and market price endpoints."""

from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_active_user, get_redis
from app.alerts.weather import WeatherService
from app.alerts.prices import PriceService
from app.alerts.schemas import (
    WeatherAlert,
    WeatherForecastWithAlerts,
    MarketPricesResponse,
    PriceTrend,
    SingleCropPricesResponse,
)

logger = structlog.get_logger()

router = APIRouter()


# ---------------------------------------------------------------------------
# Weather endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/weather",
    summary="Get weather forecast for current user location",
)
async def get_my_weather(
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
    current_user=Depends(get_current_active_user),
):
    """
    Fetch weather forecast for the authenticated user's registered location.
    Returns forecast data plus any active weather alerts.
    Falls back to Colombo (6.9271, 79.8612) if no location is stored.
    """
    svc = WeatherService(redis=redis)
    result = await svc.get_forecast_for_user(db=db, user_id=current_user.id)
    return result


@router.get(
    "/weather/{lat}/{lng}",
    summary="Get weather forecast for specific coordinates",
)
async def get_weather_for_location(
    lat: float,
    lng: float,
    redis=Depends(get_redis),
    _current_user=Depends(get_current_active_user),
):
    """
    Fetch weather forecast for any lat/lng coordinate pair.
    Cached in Redis for 1 hour.
    """
    svc = WeatherService(redis=redis)
    forecast = await svc.fetch_forecast(lat=lat, lng=lng)
    alerts = svc.check_weather_alerts(forecast)

    return {
        "location": {"latitude": lat, "longitude": lng},
        "alert_count": len(alerts),
        "alerts": alerts,
        "forecast": forecast,
    }


# ---------------------------------------------------------------------------
# Price endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/prices",
    summary="Get market prices for all active crops",
)
async def get_all_prices(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """
    Return latest market prices for all active crops, with price alerts
    for significant movements (drop >= 15% or surge >= 20% vs 7-day avg).
    """
    svc = PriceService(db=db)
    result = await svc.get_market_prices_for_user(db=db, user_id=current_user.id)
    return result


@router.get(
    "/prices/{crop_id}",
    summary="Get latest market prices for a specific crop",
)
async def get_prices_for_crop(
    crop_id: UUID,
    days: int = Query(30, ge=1, le=365, description="Number of days of history"),
    db: AsyncSession = Depends(get_db),
    _current_user=Depends(get_current_active_user),
):
    """
    Return latest per-market prices and current alerts for a specific crop.
    """
    svc = PriceService(db=db)
    latest = await svc.fetch_latest_prices(crop_id)
    alerts = await svc.check_price_alerts(crop_id)

    return {
        "crop_id": str(crop_id),
        "latest_prices": latest,
        "alerts": alerts,
    }


@router.get(
    "/prices/{crop_id}/trend",
    summary="Get price trend for a specific crop",
)
async def get_price_trend(
    crop_id: UUID,
    days: int = Query(30, ge=7, le=365, description="Number of days for trend window"),
    db: AsyncSession = Depends(get_db),
    _current_user=Depends(get_current_active_user),
):
    """
    Return daily average, min, and max prices per market for a crop
    over the specified number of days, suitable for chart rendering.
    """
    svc = PriceService(db=db)
    trend = await svc.get_trend_data(crop_id=crop_id, days=days)
    return trend
