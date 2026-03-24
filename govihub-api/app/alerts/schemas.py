"""GoviHub Alerts Schemas — Weather and Price alert Pydantic v2 models."""

from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Weather schemas
# ---------------------------------------------------------------------------

class WeatherPeriod(BaseModel):
    """A single 3-hour forecast period."""
    dt_txt: str
    temp: float = Field(..., description="Temperature in °C")
    feels_like: float
    humidity: int
    wind_speed: float = Field(..., description="Wind speed in m/s")
    rain_3h: float = Field(0.0, description="Rainfall in last 3 hours (mm)")
    description: str
    icon: Optional[str] = None


class WeatherForecast(BaseModel):
    """Structured weather forecast response."""
    latitude: float
    longitude: float
    city: Optional[str] = None
    country: Optional[str] = None
    periods: list[WeatherPeriod]
    is_mock: bool = False
    fetched_at: datetime


class WeatherAlert(BaseModel):
    """A single weather alert derived from forecast thresholds."""
    type: str = Field(
        ...,
        description="Alert type: heavy_rain | heat | strong_wind | extreme_wind"
    )
    severity: str = Field(..., description="Severity: moderate | high")
    message: str
    dt_txt: str = Field(..., description="Forecast period timestamp")
    value: float = Field(..., description="The triggering measurement value")
    unit: str = Field(..., description="Unit of the value (mm/3h, °C, m/s)")


class WeatherForecastWithAlerts(BaseModel):
    """Combined forecast and alerts response."""
    location: dict
    alert_count: int
    alerts: list[WeatherAlert]
    forecast: Any = Field(..., description="Raw OpenWeather forecast payload")


# ---------------------------------------------------------------------------
# Price schemas
# ---------------------------------------------------------------------------

class MarketPrice(BaseModel):
    """A single market price entry."""
    market_name: str
    price_per_kg: float
    unit: str = "LKR"
    recorded_date: str
    source: Optional[str] = None


class CropMarketPrices(BaseModel):
    """Latest market prices for a single crop."""
    crop_id: UUID
    crop_name: str
    crop_name_si: Optional[str] = None
    category: str
    latest_prices: list[MarketPrice]


class PriceTrendPoint(BaseModel):
    """A single data point in a price trend series."""
    date: str
    market_name: str
    avg_price: float
    min_price: float
    max_price: float


class PriceTrend(BaseModel):
    """Price trend data for a crop over a time window."""
    crop_id: UUID
    crop_name: str
    crop_name_si: Optional[str] = None
    days: int
    data_points: list[PriceTrendPoint]


class PriceAlert(BaseModel):
    """A price movement alert for a crop at a specific market."""
    type: str = Field(
        ...,
        description="Alert type: price_drop | price_surge"
    )
    severity: str = Field(..., description="Severity: moderate | high")
    crop_id: str
    crop_name: str
    market_name: str
    current_price: float = Field(..., description="Current price per kg in LKR")
    average_price: float = Field(..., description="7-day average price per kg")
    change_pct: float = Field(..., description="Percentage change from 7-day average")
    message: str
    recorded_date: str


class MarketPricesResponse(BaseModel):
    """Full market prices response for all crops."""
    prices: list[CropMarketPrices]
    alerts: list[PriceAlert]
    alert_count: int
    generated_at: str


class SingleCropPricesResponse(BaseModel):
    """Price response for a single crop ID."""
    crop_id: str
    latest_prices: list[MarketPrice]
    alerts: list[PriceAlert]
