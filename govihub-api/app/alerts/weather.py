"""GoviHub Weather Service — OpenWeather API with Redis caching and alert thresholds."""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Weather alert thresholds
# ---------------------------------------------------------------------------

HEAVY_RAIN_MM_3H = 20.0        # mm in 3-hour window — heavy rain threshold
HEAT_TEMP_CELSIUS = 35.0       # °C — heat alert threshold
STRONG_WIND_MS = 10.0          # m/s — strong wind threshold (~36 km/h)
EXTREME_WIND_MS = 17.0         # m/s — extreme wind threshold (~60 km/h)

# Redis cache TTL
WEATHER_CACHE_TTL_SECONDS = 3600  # 1 hour

# OpenWeather API base URL
OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5"


# ---------------------------------------------------------------------------
# Mock forecast data (used when API key is not configured)
# ---------------------------------------------------------------------------

def _mock_forecast(lat: float, lng: float) -> dict:
    """Return realistic mock weather forecast for Sri Lanka."""
    now = datetime.now(timezone.utc)
    forecasts = []
    for i in range(8):  # 5-day forecast in 3h steps (only 8 for mock)
        dt = now + timedelta(hours=i * 3)
        forecasts.append({
            "dt": int(dt.timestamp()),
            "dt_txt": dt.strftime("%Y-%m-%d %H:%M:%S"),
            "main": {
                "temp": 28.5 + (i % 3) * 1.2,
                "feels_like": 31.0,
                "temp_min": 26.0,
                "temp_max": 32.0,
                "humidity": 75 + (i % 10),
                "pressure": 1010,
            },
            "weather": [
                {
                    "id": 500,
                    "main": "Rain",
                    "description": "light rain",
                    "icon": "10d",
                }
            ],
            "wind": {
                "speed": 4.5 + (i % 4) * 0.8,
                "deg": 220,
                "gust": 7.0,
            },
            "rain": {
                "3h": 2.5 + (i % 5) * 1.0,
            },
            "clouds": {"all": 60},
            "visibility": 10000,
        })

    return {
        "cod": "200",
        "city": {
            "name": "Mock City",
            "coord": {"lat": lat, "lon": lng},
            "country": "LK",
        },
        "list": forecasts,
        "mock": True,
    }


# ---------------------------------------------------------------------------
# WeatherService
# ---------------------------------------------------------------------------

class WeatherService:
    """Fetch and cache weather forecasts; evaluate alert conditions."""

    def __init__(self, redis=None):
        self._redis = redis

    # -----------------------------------------------------------------------
    # Fetch forecast (with Redis caching)
    # -----------------------------------------------------------------------

    async def fetch_forecast(self, lat: float, lng: float) -> dict:
        """
        Fetch 5-day / 3-hour forecast from OpenWeather API.
        Results are cached in Redis for 1 hour.
        Falls back to mock data if OPENWEATHER_API_KEY is not set.
        """
        cache_key = f"weather:forecast:{lat:.4f}:{lng:.4f}"

        # Try Redis cache first
        if self._redis is not None:
            try:
                cached = await self._redis.get(cache_key)
                if cached:
                    logger.debug("weather_cache_hit", lat=lat, lng=lng)
                    return json.loads(cached)
            except Exception as exc:
                logger.warning("weather_cache_read_error", error=str(exc))

        # Check if API key is configured
        api_key = settings.OPENWEATHER_API_KEY
        if not api_key:
            logger.info("weather_api_key_missing_using_mock", lat=lat, lng=lng)
            forecast = _mock_forecast(lat, lng)
        else:
            forecast = await self._call_openweather(lat, lng, api_key)

        # Store in Redis
        if self._redis is not None:
            try:
                await self._redis.setex(
                    cache_key,
                    WEATHER_CACHE_TTL_SECONDS,
                    json.dumps(forecast, default=str),
                )
            except Exception as exc:
                logger.warning("weather_cache_write_error", error=str(exc))

        return forecast

    async def _call_openweather(self, lat: float, lng: float, api_key: str) -> dict:
        """Make HTTP request to OpenWeather forecast API."""
        url = f"{OPENWEATHER_BASE_URL}/forecast"
        params = {
            "lat": lat,
            "lon": lng,
            "appid": api_key,
            "units": "metric",
            "cnt": 40,  # 5 days × 8 per day
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()
                logger.info("weather_api_fetched", lat=lat, lng=lng)
                return data
            except httpx.HTTPStatusError as exc:
                logger.error("weather_api_http_error", status=exc.response.status_code, lat=lat, lng=lng)
                return _mock_forecast(lat, lng)
            except Exception as exc:
                logger.error("weather_api_error", error=str(exc), lat=lat, lng=lng)
                return _mock_forecast(lat, lng)

    # -----------------------------------------------------------------------
    # Check alerts from forecast
    # -----------------------------------------------------------------------

    def check_weather_alerts(self, forecast: dict) -> list[dict]:
        """
        Evaluate a forecast payload and return a list of alert dicts.
        Alert keys: type, severity, message, dt_txt.
        """
        alerts = []
        periods = forecast.get("list", [])

        for period in periods:
            dt_txt = period.get("dt_txt", "")
            main = period.get("main", {})
            wind = period.get("wind", {})
            rain = period.get("rain", {})

            temp = main.get("temp", 0)
            wind_speed = wind.get("speed", 0)
            rain_3h = rain.get("3h", 0)

            # Heavy rain alert
            if rain_3h >= HEAVY_RAIN_MM_3H:
                alerts.append({
                    "type": "heavy_rain",
                    "severity": "high" if rain_3h >= 40.0 else "moderate",
                    "message": f"Heavy rain expected: {rain_3h:.1f} mm in 3 hours",
                    "dt_txt": dt_txt,
                    "value": rain_3h,
                    "unit": "mm/3h",
                })

            # Heat alert
            if temp >= HEAT_TEMP_CELSIUS:
                alerts.append({
                    "type": "heat",
                    "severity": "high" if temp >= 38.0 else "moderate",
                    "message": f"High temperature: {temp:.1f}°C",
                    "dt_txt": dt_txt,
                    "value": temp,
                    "unit": "°C",
                })

            # Strong wind alert
            if wind_speed >= EXTREME_WIND_MS:
                alerts.append({
                    "type": "extreme_wind",
                    "severity": "high",
                    "message": f"Extreme wind speed: {wind_speed:.1f} m/s ({wind_speed * 3.6:.0f} km/h)",
                    "dt_txt": dt_txt,
                    "value": wind_speed,
                    "unit": "m/s",
                })
            elif wind_speed >= STRONG_WIND_MS:
                alerts.append({
                    "type": "strong_wind",
                    "severity": "moderate",
                    "message": f"Strong wind: {wind_speed:.1f} m/s ({wind_speed * 3.6:.0f} km/h)",
                    "dt_txt": dt_txt,
                    "value": wind_speed,
                    "unit": "m/s",
                })

        return alerts

    # -----------------------------------------------------------------------
    # Get forecast for a user (uses their stored location)
    # -----------------------------------------------------------------------

    async def get_forecast_for_user(self, db: AsyncSession, user_id: UUID) -> dict:
        """
        Fetch weather forecast for the user's registered location.
        Falls back to Colombo coords if user has no location stored.
        """
        from app.users.models import User

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        # Default to Colombo if user has no location
        lat, lng = 6.9271, 79.8612

        if user and user.location is not None:
            try:
                from geoalchemy2.shape import to_shape
                point = to_shape(user.location)
                lat = point.y
                lng = point.x
            except Exception:
                pass

        forecast = await self.fetch_forecast(lat, lng)
        alerts = self.check_weather_alerts(forecast)

        return {
            "forecast": forecast,
            "alerts": alerts,
            "location": {"latitude": lat, "longitude": lng},
            "alert_count": len(alerts),
        }
