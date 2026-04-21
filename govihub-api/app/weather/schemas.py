"""Weather Schemas — Pydantic models for crop selections and weather alerts."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

# ── Valid values ──────────────────────────────────────────────────
VALID_CROP_TYPES = [
    "black_pepper", "cinnamon", "turmeric", "ginger",
    "cloves", "nutmeg", "cardamom", "mixed_spices",
]

VALID_GROWTH_STAGES = ["seedling", "vegetative", "flowering", "harvesting", "dormant"]


# ── Crop Selection Schemas ────────────────────────────────────────

class CropSelectionCreate(BaseModel):
    crop_type: str = Field(..., description="Must be one of 8 valid spice types")
    growth_stage: Optional[str] = Field("vegetative", description="Growth stage")
    area_hectares: Optional[float] = Field(None, ge=0, le=999.99)
    is_primary: Optional[bool] = False


class CropSelectionUpdate(BaseModel):
    growth_stage: Optional[str] = None
    area_hectares: Optional[float] = Field(None, ge=0, le=999.99)
    is_primary: Optional[bool] = None


class CropSelectionRead(BaseModel):
    crop_type: str
    name_si: str
    name_en: str
    growth_stage: Optional[str] = None
    area_hectares: Optional[float] = None
    is_primary: bool = False

    model_config = {"from_attributes": True}


class CropSelectionListResponse(BaseModel):
    crops: list[CropSelectionRead]
    count: int


class AvailableCropItem(BaseModel):
    crop_type: str
    name_si: str
    name_en: str
    selected: bool
    growth_stage: Optional[str] = None
    area_hectares: Optional[float] = None


class AvailableCropsResponse(BaseModel):
    crops: list[AvailableCropItem]


# ── Weather Alert Schemas ─────────────────────────────────────────

class WeatherAlertRead(BaseModel):
    id: UUID
    crop_type: str
    crop_name_si: str = ""
    alert_type: str
    severity: str
    forecast_date: date
    message_si: str
    message_en: Optional[str] = None
    is_read: bool
    created_at: datetime
    weather_data: Optional[dict] = None

    model_config = {"from_attributes": True}


class WeatherAlertListResponse(BaseModel):
    alerts: list[WeatherAlertRead]
    unread_count: int
    total: int
