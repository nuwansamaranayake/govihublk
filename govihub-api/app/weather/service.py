"""Weather Service — Open-Meteo API integration with Redis caching."""

import json
import math
from datetime import date, datetime, timezone

import httpx
import structlog
from redis.asyncio import Redis

from app.weather.crop_profiles import CROP_WEATHER_PROFILES, get_crop_profile

logger = structlog.get_logger()

OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast"

# Default pilot location — Anuradhapura
DEFAULT_LAT = 8.3114
DEFAULT_LNG = 80.4037

# District center coordinates for location fallback
DISTRICT_COORDS: dict[str, tuple[float, float]] = {
    "Anuradhapura": (8.3114, 80.4037),
    "Polonnaruwa": (7.9403, 81.0188),
    "Colombo": (6.9271, 79.8612),
    "Kurunegala": (7.4863, 80.3647),
    "Kandy": (7.2906, 80.6337),
    "Matale": (7.4675, 80.6234),
    "Galle": (6.0535, 80.2210),
    "Jaffna": (9.6615, 80.0255),
    "Batticaloa": (7.7310, 81.6747),
    "Badulla": (6.9934, 81.0550),
    "Ratnapura": (6.6828, 80.4028),
    "Trincomalee": (8.5874, 81.2152),
    "Hambantota": (6.1429, 81.1212),
    "Matara": (5.9549, 80.5550),
    "Nuwara Eliya": (6.9497, 80.7891),
    "Kegalle": (7.2513, 80.3464),
    "Puttalam": (8.0362, 79.8283),
    "Monaragala": (6.8728, 81.3507),
    "Ampara": (7.2955, 81.6820),
    "Mullaitivu": (9.2671, 80.8142),
    "Kilinochchi": (9.3803, 80.3770),
    "Mannar": (8.9810, 79.9044),
    "Vavuniya": (8.7514, 80.4971),
}

# Sinhala day names
DAY_NAMES_SI = ["ඉරිදා", "සඳුදා", "අඟහරුවාදා", "බදාදා", "බ්‍රහස්පතින්දා", "සිකුරාදා", "සෙනසුරාදා"]
DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

# Cache TTLs
FORECAST_CACHE_TTL = 1800  # 30 minutes
ADVISORY_CACHE_TTL = 10800  # 3 hours


def _round_coord(v: float) -> float:
    """Round to 2 decimal places (≈1.1 km — fine for 11 km grid)."""
    return round(v, 2)


def _cache_key(lat: float, lng: float) -> str:
    return f"weather:forecast:{_round_coord(lat)}:{_round_coord(lng)}"


def _weather_icon(code: int | None) -> str:
    """Map WMO weather code to emoji."""
    if code is None:
        return "🌤"
    if code == 0:
        return "☀️"
    if code in (1, 2):
        return "🌤"
    if code == 3:
        return "☁️"
    if code in (45, 48):
        return "🌫️"
    if code in (51, 53, 55, 56, 57):
        return "🌦"
    if code in (61, 63, 65, 66, 67):
        return "🌧"
    if code in (71, 73, 75, 77):
        return "❄️"
    if code in (80, 81, 82):
        return "🌧"
    if code in (85, 86):
        return "❄️"
    if code in (95, 96, 99):
        return "⛈"
    return "🌤"


def _weather_condition(code: int | None) -> str:
    """Map WMO weather code to human-readable condition."""
    if code is None:
        return "Clear"
    mapping = {
        0: "Clear Sky",
        1: "Mainly Clear",
        2: "Partly Cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Depositing Fog",
        51: "Light Drizzle",
        53: "Moderate Drizzle",
        55: "Dense Drizzle",
        56: "Freezing Drizzle",
        57: "Dense Freezing Drizzle",
        61: "Slight Rain",
        63: "Moderate Rain",
        65: "Heavy Rain",
        66: "Freezing Rain",
        67: "Heavy Freezing Rain",
        71: "Slight Snow",
        73: "Moderate Snow",
        75: "Heavy Snow",
        77: "Snow Grains",
        80: "Slight Showers",
        81: "Moderate Showers",
        82: "Violent Showers",
        85: "Slight Snow Showers",
        86: "Heavy Snow Showers",
        95: "Thunderstorm",
        96: "Thunderstorm + Hail",
        99: "Thunderstorm + Heavy Hail",
    }
    return mapping.get(code, "Clear")


def _day_name(date_str: str) -> tuple[str, str]:
    """Return (si_name, en_name) for a date string YYYY-MM-DD."""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        dow = d.weekday()  # 0=Monday
        # Convert to Sunday-based index
        idx = (dow + 1) % 7
        return DAY_NAMES_SI[idx], DAY_NAMES_EN[idx]
    except Exception:
        return "", ""


def resolve_location(
    lat: float | None, lng: float | None, user=None
) -> tuple[float, float, str]:
    """
    Resolve coordinates.  Priority: explicit params > user.location > user.district > default.
    Returns (lat, lng, location_name).
    """
    if lat is not None and lng is not None:
        name = _closest_district(lat, lng)
        return lat, lng, name

    if user is not None:
        # PostGIS location
        if user.location is not None:
            try:
                from geoalchemy2.shape import to_shape

                point = to_shape(user.location)
                name = user.district or _closest_district(point.y, point.x)
                return point.y, point.x, name
            except Exception:
                pass

        # Fallback to district
        if user.district:
            coords = DISTRICT_COORDS.get(user.district)
            if coords:
                return coords[0], coords[1], user.district

    return DEFAULT_LAT, DEFAULT_LNG, "Anuradhapura"


def _closest_district(lat: float, lng: float) -> str:
    """Find the closest district by Euclidean distance."""
    best = "Unknown"
    best_dist = float("inf")
    for name, (dlat, dlng) in DISTRICT_COORDS.items():
        d = math.hypot(lat - dlat, lng - dlng)
        if d < best_dist:
            best_dist = d
            best = name
    return best


async def fetch_forecast(
    lat: float,
    lng: float,
    redis: Redis,
    days: int = 7,
) -> dict:
    """
    Fetch weather forecast from Open-Meteo with Redis caching.
    Returns parsed forecast dict with daily + hourly + current data.
    Raises on API failure (no mock data).
    """
    rlat, rlng = _round_coord(lat), _round_coord(lng)
    cache_key = _cache_key(lat, lng)

    # Check cache
    cached = await redis.get(cache_key)
    if cached:
        logger.debug("weather_cache_hit", lat=rlat, lng=rlng)
        return json.loads(cached)

    # Fetch from Open-Meteo
    logger.info("weather_api_call", lat=rlat, lng=rlng, days=days)
    params = {
        "latitude": rlat,
        "longitude": rlng,
        "daily": ",".join([
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "precipitation_probability_max",
            "wind_speed_10m_max",
            "wind_gusts_10m_max",
            "et0_fao_evapotranspiration",
            "uv_index_max",
            "sunrise",
            "sunset",
            "weather_code",
        ]),
        "hourly": ",".join([
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "precipitation_probability",
            "soil_temperature_6cm",
            "soil_moisture_3_to_9cm",
            "wind_speed_10m",
            "cloud_cover",
        ]),
        "current": ",".join([
            "temperature_2m",
            "relative_humidity_2m",
            "weather_code",
            "wind_speed_10m",
            "precipitation",
        ]),
        "forecast_days": min(days, 16),
        "timezone": "Asia/Colombo",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(OPEN_METEO_BASE, params=params)
        resp.raise_for_status()
        raw = resp.json()

    # Cache
    await redis.set(cache_key, json.dumps(raw), ex=FORECAST_CACHE_TTL)
    logger.info("weather_cached", lat=rlat, lng=rlng, ttl=FORECAST_CACHE_TTL)
    return raw


def _extract_hourly_for_date(hourly: dict, target_date: str) -> list[dict]:
    """Extract hourly data for a specific date from the full hourly arrays."""
    h_times = hourly.get("time", [])
    h_temp = hourly.get("temperature_2m", [])
    h_humidity = hourly.get("relative_humidity_2m", [])
    h_precip = hourly.get("precipitation", [])
    h_precip_prob = hourly.get("precipitation_probability", [])
    h_wind = hourly.get("wind_speed_10m", [])
    h_cloud = hourly.get("cloud_cover", [])
    h_soil_temp = hourly.get("soil_temperature_6cm", [])
    h_soil_moist = hourly.get("soil_moisture_3_to_9cm", [])

    entries = []
    for i, t in enumerate(h_times):
        if not t or not t.startswith(target_date):
            continue
        time_part = t.split("T")[1] if "T" in t else t
        entries.append({
            "time": time_part[:5] if len(time_part) >= 5 else time_part,
            "temp": h_temp[i] if i < len(h_temp) else None,
            "humidity": h_humidity[i] if i < len(h_humidity) else None,
            "precipitation_mm": h_precip[i] if i < len(h_precip) else 0,
            "precipitation_probability": h_precip_prob[i] if i < len(h_precip_prob) else 0,
            "soil_temp_6cm": h_soil_temp[i] if i < len(h_soil_temp) else None,
            "soil_moisture": h_soil_moist[i] if i < len(h_soil_moist) else None,
            "wind_speed_kmh": h_wind[i] if i < len(h_wind) else 0,
            "cloud_cover": h_cloud[i] if i < len(h_cloud) else 0,
        })
    return entries


def _compute_soil_conditions(hourly_entries: list[dict]) -> dict:
    """Compute soil conditions summary from hourly data."""
    soil_temps = [e["soil_temp_6cm"] for e in hourly_entries if e.get("soil_temp_6cm") is not None]
    soil_moistures = [e["soil_moisture"] for e in hourly_entries if e.get("soil_moisture") is not None]

    if not soil_temps and not soil_moistures:
        return {}

    avg_temp = round(sum(soil_temps) / len(soil_temps), 1) if soil_temps else None
    avg_moisture = round(sum(soil_moistures) / len(soil_moistures), 2) if soil_moistures else None

    # Generate interpretation
    interp_si = ""
    interp_en = ""
    if avg_temp is not None:
        if 25 <= avg_temp <= 30:
            interp_si = f"පස් උෂ්ණත්වය {avg_temp}°C — ඉඟුරු/කහ බීජ පැල කිරීමට සුදුසුයි"
            interp_en = f"Soil temp {avg_temp}°C — suitable for ginger/turmeric sprouting"
        elif avg_temp < 17:
            interp_si = f"පස් උෂ්ණත්වය {avg_temp}°C — ඉතා සීතල, අංකුරණය බාධා වේ"
            interp_en = f"Soil temp {avg_temp}°C — too cold, sprouting impaired"
        elif avg_temp > 32:
            interp_si = f"පස් උෂ්ණත්වය {avg_temp}°C — ඉතා උණුසුම්, පටක හානිය විය හැක"
            interp_en = f"Soil temp {avg_temp}°C — too hot, tissue damage risk"
        else:
            interp_si = f"පස් උෂ්ණත්වය {avg_temp}°C — සාමාන්‍ය"
            interp_en = f"Soil temp {avg_temp}°C — normal"

    return {
        "current_soil_temp_6cm": avg_temp,
        "current_soil_moisture": avg_moisture,
        "soil_temp_trend": "stable",
        "interpretation_si": interp_si,
        "interpretation_en": interp_en,
    }


def format_forecast_response(raw: dict, location_name: str) -> dict:
    """
    Transform Open-Meteo raw response into frontend-friendly format.
    Returns a structured dict with today's weather + daily summaries + soil conditions.
    """
    daily = raw.get("daily", {})
    current = raw.get("current", {})
    hourly = raw.get("hourly", {})

    times = daily.get("time", [])
    temp_max = daily.get("temperature_2m_max", [])
    temp_min = daily.get("temperature_2m_min", [])
    precip = daily.get("precipitation_sum", [])
    precip_prob = daily.get("precipitation_probability_max", [])
    wind_max = daily.get("wind_speed_10m_max", [])
    wind_gust = daily.get("wind_gusts_10m_max", [])
    uv = daily.get("uv_index_max", [])
    et0 = daily.get("et0_fao_evapotranspiration", [])
    sunrise = daily.get("sunrise", [])
    sunset = daily.get("sunset", [])
    codes = daily.get("weather_code", [])

    days_list = []
    for i, dt in enumerate(times):
        code = codes[i] if i < len(codes) else None
        day_si, day_en = _day_name(dt)
        days_list.append({
            "date": dt,
            "day_name_si": day_si,
            "day_name_en": day_en,
            "temp_max": temp_max[i] if i < len(temp_max) else None,
            "temp_min": temp_min[i] if i < len(temp_min) else None,
            "precipitation_mm": precip[i] if i < len(precip) else 0,
            "precipitation_prob": precip_prob[i] if i < len(precip_prob) else 0,
            "wind_max_kmh": wind_max[i] if i < len(wind_max) else 0,
            "wind_gust_kmh": wind_gust[i] if i < len(wind_gust) else 0,
            "uv_index": uv[i] if i < len(uv) else 0,
            "evapotranspiration": et0[i] if i < len(et0) else 0,
            "sunrise": sunrise[i] if i < len(sunrise) else None,
            "sunset": sunset[i] if i < len(sunset) else None,
            "weather_code": code,
            "icon": _weather_icon(code),
            "condition": _weather_condition(code),
            "reliability": "high" if i < 3 else "moderate" if i < 5 else "low",
        })

    # Current conditions
    current_data = {
        "temp": current.get("temperature_2m"),
        "humidity": current.get("relative_humidity_2m"),
        "weather_code": current.get("weather_code"),
        "wind_speed": current.get("wind_speed_10m"),
        "precipitation": current.get("precipitation"),
        "icon": _weather_icon(current.get("weather_code")),
        "condition": _weather_condition(current.get("weather_code")),
    }

    # Hourly for today (first 24 entries by today's date)
    today_str = times[0] if times else date.today().isoformat()
    hourly_today = _extract_hourly_for_date(hourly, today_str)

    # Soil conditions from today's hourly
    soil_conditions = _compute_soil_conditions(hourly_today)

    return {
        "location": location_name,
        "latitude": raw.get("latitude"),
        "longitude": raw.get("longitude"),
        "timezone": raw.get("timezone", "Asia/Colombo"),
        "current": current_data,
        "daily": days_list,
        "hourly_today": hourly_today,
        "soil_conditions": soil_conditions,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


def format_hourly_for_date(raw: dict, target_date: str, location_name: str) -> dict:
    """
    Extract hourly detail for a specific date from raw Open-Meteo response.
    Used by GET /weather/forecast/{date}.
    """
    hourly = raw.get("hourly", {})
    daily = raw.get("daily", {})

    entries = _extract_hourly_for_date(hourly, target_date)

    # Get daily summary for this date
    day_summary = {}
    times = daily.get("time", [])
    if target_date in times:
        idx = times.index(target_date)
        code = daily.get("weather_code", [])[idx] if idx < len(daily.get("weather_code", [])) else None
        day_si, day_en = _day_name(target_date)
        day_summary = {
            "temp_max": daily.get("temperature_2m_max", [])[idx] if idx < len(daily.get("temperature_2m_max", [])) else None,
            "temp_min": daily.get("temperature_2m_min", [])[idx] if idx < len(daily.get("temperature_2m_min", [])) else None,
            "precipitation_mm": daily.get("precipitation_sum", [])[idx] if idx < len(daily.get("precipitation_sum", [])) else 0,
            "precipitation_prob": daily.get("precipitation_probability_max", [])[idx] if idx < len(daily.get("precipitation_probability_max", [])) else 0,
            "wind_max_kmh": daily.get("wind_speed_10m_max", [])[idx] if idx < len(daily.get("wind_speed_10m_max", [])) else 0,
            "uv_index": daily.get("uv_index_max", [])[idx] if idx < len(daily.get("uv_index_max", [])) else 0,
            "icon": _weather_icon(code),
            "condition": _weather_condition(code),
            "day_name_si": day_si,
            "day_name_en": day_en,
        }

    soil_conditions = _compute_soil_conditions(entries)

    return {
        "date": target_date,
        "location": location_name,
        "summary": day_summary,
        "hourly": entries,
        "soil_conditions": soil_conditions,
    }


def evaluate_crop_alerts(
    forecast: dict,
    crop_types: list[str] | None = None,
    growth_stages: dict[str, str] | None = None,
) -> list[dict]:
    """
    Evaluate weather forecast against crop profiles to generate alerts.
    If crop_types is None, evaluate all profiles.
    growth_stages: optional dict mapping crop_type -> current growth stage.
    Returns alerts with bilingual messages.
    """
    alerts = []
    daily = forecast.get("daily", [])
    hourly = forecast.get("hourly_today", [])
    if not daily:
        return alerts

    types_to_check = crop_types or list(CROP_WEATHER_PROFILES.keys())
    growth_stages = growth_stages or {}

    # Get current soil temp from hourly if available
    soil_temps = [h.get("soil_temp_6cm") or h.get("soil_temp") for h in hourly if h.get("soil_temp_6cm") or h.get("soil_temp")]
    avg_soil_temp = round(sum(soil_temps) / len(soil_temps), 1) if soil_temps else None

    for crop_type in types_to_check:
        profile = CROP_WEATHER_PROFILES.get(crop_type)
        if not profile:
            continue

        crop_alerts = profile.get("alerts", {})
        stage = growth_stages.get(crop_type)

        for day in daily[:3]:  # Focus on 3-day actionable window
            dt = day.get("date", "")
            temp_max = day.get("temp_max")
            temp_min = day.get("temp_min")
            precip = day.get("precipitation_mm", 0)
            precip_prob = day.get("precipitation_prob", 0)
            wind = day.get("wind_max_kmh", 0)

            # Rule 1: Heat stress
            critical_high = profile.get("critical_temp_high", 40)
            if temp_max and temp_max > critical_high:
                alert_msg = crop_alerts.get("heat_stress", {})
                alerts.append({
                    "crop": crop_type,
                    "crop_name_si": profile["name_si"],
                    "type": "heat_stress",
                    "severity": "warning",
                    "date": dt,
                    "message_si": alert_msg.get("si", f"උෂ්ණත්වය {temp_max}°C — ඉහළ මට්ටමක"),
                    "message_en": alert_msg.get("en", f"High temp {temp_max}°C exceeds {profile['name_en']} tolerance ({critical_high}°C)"),
                    "icon": "🌡️",
                })

            # Rule 2: Cold stress
            critical_low = profile.get("critical_temp_low", 0)
            if temp_min and temp_min < critical_low:
                alert_msg = crop_alerts.get("cold_stress", {})
                alerts.append({
                    "crop": crop_type,
                    "crop_name_si": profile["name_si"],
                    "type": "cold_stress",
                    "severity": "critical",
                    "date": dt,
                    "message_si": alert_msg.get("si", f"උෂ්ණත්වය {temp_min}°C — ඉතා අඩු"),
                    "message_en": alert_msg.get("en", f"Low temp {temp_min}°C below {profile['name_en']} minimum ({critical_low}°C)"),
                    "icon": "🥶",
                })

            # Rule 3: Heavy rain (precipitation > 50mm AND waterlog_sensitive)
            if precip and precip > 50 and profile.get("waterlog_sensitive"):
                alert_msg = crop_alerts.get("heavy_rain", {})
                alerts.append({
                    "crop": crop_type,
                    "crop_name_si": profile["name_si"],
                    "type": "heavy_rain",
                    "severity": "warning",
                    "date": dt,
                    "message_si": alert_msg.get("si", f"දැඩි වැසි {precip}mm — ජලය බැස යාම පරීක්ෂා කරන්න"),
                    "message_en": alert_msg.get("en", f"Heavy rain {precip}mm — waterlogging risk for {profile['name_en']}"),
                    "icon": "🌧️",
                })

            # Rule 4: Rain probability high (>60% AND waterlog_sensitive)
            elif precip_prob and precip_prob > 60 and profile.get("waterlog_sensitive"):
                alert_msg = crop_alerts.get("heavy_rain", {})
                alerts.append({
                    "crop": crop_type,
                    "crop_name_si": profile["name_si"],
                    "type": "heavy_rain",
                    "severity": "info",
                    "date": dt,
                    "message_si": alert_msg.get("si", f"වැසි ඉඩ {precip_prob}% — සූදානම් වන්න"),
                    "message_en": alert_msg.get("en", f"Rain probability {precip_prob}% — prepare for {profile['name_en']}"),
                    "icon": "🌦",
                })

            # Rule 5: High wind
            threshold = profile.get("wind_threshold_kmh", 50)
            if profile.get("wind_sensitive") and wind and wind > threshold:
                alert_msg = crop_alerts.get("high_wind", {})
                alerts.append({
                    "crop": crop_type,
                    "crop_name_si": profile["name_si"],
                    "type": "high_wind",
                    "severity": "warning",
                    "date": dt,
                    "message_si": alert_msg.get("si", f"සුළං වේගය {wind} km/h — අවදානම"),
                    "message_en": alert_msg.get("en", f"Wind {wind} km/h exceeds safe limit ({threshold} km/h)"),
                    "icon": "💨",
                })

        # Rule 6: Cold soil (for ginger/turmeric)
        soil_critical_low = profile.get("soil_temp_critical_low")
        if soil_critical_low and avg_soil_temp and avg_soil_temp < soil_critical_low:
            alert_msg = crop_alerts.get("cold_soil", {})
            alerts.append({
                "crop": crop_type,
                "crop_name_si": profile["name_si"],
                "type": "cold_soil",
                "severity": "info",
                "date": daily[0].get("date", "") if daily else "",
                "message_si": alert_msg.get("si", f"පස් උෂ්ණත්වය {avg_soil_temp}°C — ඉතා අඩු"),
                "message_en": alert_msg.get("en", f"Soil temp {avg_soil_temp}°C — below {soil_critical_low}°C threshold"),
                "icon": "🌡️",
            })

        # Rule 7: Hot soil (for turmeric)
        if crop_type == "turmeric" and avg_soil_temp and avg_soil_temp > 32:
            alert_msg = crop_alerts.get("hot_soil", {})
            alerts.append({
                "crop": crop_type,
                "crop_name_si": profile["name_si"],
                "type": "hot_soil",
                "severity": "warning",
                "date": daily[0].get("date", "") if daily else "",
                "message_si": alert_msg.get("si", f"පස් උෂ්ණත්වය {avg_soil_temp}°C — ඉතා ඉහළ"),
                "message_en": alert_msg.get("en", f"Soil temp {avg_soil_temp}°C — tissue damage risk"),
                "icon": "🌡️",
            })

        # Rule 10: Growth stage specific alerts
        if stage and profile.get("growth_stage_alerts"):
            stage_info = profile["growth_stage_alerts"].get(stage)
            if stage_info:
                # Check if the stage alert is relevant to current conditions
                # For flowering + rain, for harvesting + rain, etc.
                if "rain" in stage_info.lower() and daily:
                    for day in daily[:3]:
                        if day.get("precipitation_prob", 0) > 40:
                            alerts.append({
                                "crop": crop_type,
                                "crop_name_si": profile["name_si"],
                                "type": "growth_stage",
                                "severity": "info",
                                "date": day.get("date", ""),
                                "message_si": f"{profile['name_si']} — {stage_info}",
                                "message_en": f"{profile['name_en']} ({stage}): {stage_info}",
                                "icon": "🌱",
                            })
                            break

    # If no alerts found for any crop, add a "good" status for each
    crops_with_alerts = {a["crop"] for a in alerts}
    for crop_type in types_to_check:
        if crop_type not in crops_with_alerts:
            profile = CROP_WEATHER_PROFILES.get(crop_type)
            if not profile:
                continue
            alerts.append({
                "crop": crop_type,
                "crop_name_si": profile["name_si"],
                "type": "good",
                "severity": "good",
                "date": daily[0].get("date", "") if daily else "",
                "message_si": f"ඉදිරි දින 3 {profile['name_si']}වලට හොඳයි",
                "message_en": f"Next 3 days good for {profile['name_en']}",
                "icon": "✅",
            })

    # Deduplicate: keep highest severity per crop+type
    seen = {}
    severity_rank = {"critical": 4, "warning": 3, "info": 2, "good": 1}
    for a in alerts:
        key = f"{a['crop']}:{a['type']}"
        if key not in seen or severity_rank.get(a["severity"], 0) > severity_rank.get(
            seen[key]["severity"], 0
        ):
            seen[key] = a
    return list(seen.values())
