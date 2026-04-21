"""GoviHub Listings Schemas — Pydantic v2 models for HarvestListing and DemandPosting."""

from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Crop Taxonomy (brief)
# ---------------------------------------------------------------------------

class CropBrief(BaseModel):
    id: UUID
    code: str
    name_en: str
    name_si: str
    name_ta: Optional[str] = None
    category: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Harvest Listing Schemas
# ---------------------------------------------------------------------------

class HarvestListingCreate(BaseModel):
    crop_id: UUID
    variety: Optional[str] = Field(None, max_length=100)
    quantity_kg: float = Field(..., gt=0, description="Quantity available in kilograms")
    price_per_kg: Optional[float] = Field(None, ge=0)
    min_price_per_kg: Optional[float] = Field(None, ge=0)
    quality_grade: Optional[str] = Field(None, max_length=10)
    harvest_date: Optional[date] = None
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    description: Optional[str] = None
    images: Optional[list[str]] = None
    is_organic: bool = False
    delivery_available: bool = False
    delivery_radius_km: Optional[int] = Field(None, ge=0, le=500)
    status: Optional[str] = Field("ready", description="Initial status (defaults to ready for immediate matching)")

    @model_validator(mode="after")
    def validate_location(self) -> "HarvestListingCreate":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Both latitude and longitude must be provided together")
        return self

    @model_validator(mode="after")
    def validate_dates(self) -> "HarvestListingCreate":
        if self.available_from and self.available_until:
            if self.available_from > self.available_until:
                raise ValueError("available_from must be before available_until")
        return self

    @model_validator(mode="after")
    def validate_delivery(self) -> "HarvestListingCreate":
        if self.delivery_available and self.delivery_radius_km is None:
            raise ValueError("delivery_radius_km is required when delivery_available is True")
        return self


class HarvestListingUpdate(BaseModel):
    variety: Optional[str] = Field(None, max_length=100)
    quantity_kg: Optional[float] = Field(None, gt=0)
    price_per_kg: Optional[float] = Field(None, ge=0)
    min_price_per_kg: Optional[float] = Field(None, ge=0)
    quality_grade: Optional[str] = Field(None, max_length=10)
    harvest_date: Optional[date] = None
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    description: Optional[str] = None
    images: Optional[list[str]] = None
    is_organic: Optional[bool] = None
    delivery_available: Optional[bool] = None
    delivery_radius_km: Optional[int] = Field(None, ge=0, le=500)


class HarvestStatusUpdate(BaseModel):
    status: str = Field(
        ...,
        description="New status: planned, ready, matched, fulfilled, expired, cancelled",
    )


class HarvestListingBrief(BaseModel):
    id: UUID
    farmer_id: UUID
    crop_id: UUID
    crop: Optional[CropBrief] = None
    variety: Optional[str] = None
    quantity_kg: float
    price_per_kg: Optional[float] = None
    quality_grade: Optional[str] = None
    status: str
    is_organic: bool
    delivery_available: bool
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class HarvestListingRead(BaseModel):
    id: UUID
    farmer_id: UUID
    crop_id: UUID
    crop: Optional[CropBrief] = None
    variety: Optional[str] = None
    quantity_kg: float
    price_per_kg: Optional[float] = None
    min_price_per_kg: Optional[float] = None
    quality_grade: Optional[str] = None
    harvest_date: Optional[date] = None
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    images: Optional[list[str]] = None
    status: str
    is_organic: bool
    delivery_available: bool
    delivery_radius_km: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HarvestListingFilter(BaseModel):
    crop_id: Optional[UUID] = None
    category: Optional[str] = None
    status: Optional[str] = None
    is_organic: Optional[bool] = None
    quality_grade: Optional[str] = None
    min_price: Optional[float] = Field(None, ge=0)
    max_price: Optional[float] = Field(None, ge=0)
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    # Geo filter
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    radius_km: Optional[float] = Field(None, gt=0, le=500)


# ---------------------------------------------------------------------------
# Demand Posting Schemas
# ---------------------------------------------------------------------------

class DemandPostingCreate(BaseModel):
    crop_id: UUID
    variety: Optional[str] = Field(None, max_length=100)
    quantity_kg: float = Field(..., gt=0, description="Quantity needed in kilograms")
    max_price_per_kg: Optional[float] = Field(None, ge=0)
    quality_grade: Optional[str] = Field(None, max_length=10)
    needed_by: Optional[date] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    radius_km: int = Field(50, ge=1, le=500)
    description: Optional[str] = None
    is_recurring: bool = False
    recurrence_pattern: Optional[dict[str, Any]] = None

    @model_validator(mode="after")
    def validate_location(self) -> "DemandPostingCreate":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Both latitude and longitude must be provided together")
        return self

    @model_validator(mode="after")
    def validate_recurrence(self) -> "DemandPostingCreate":
        if self.is_recurring and self.recurrence_pattern is None:
            raise ValueError("recurrence_pattern is required when is_recurring is True")
        return self


class DemandPostingUpdate(BaseModel):
    variety: Optional[str] = Field(None, max_length=100)
    quantity_kg: Optional[float] = Field(None, gt=0)
    max_price_per_kg: Optional[float] = Field(None, ge=0)
    quality_grade: Optional[str] = Field(None, max_length=10)
    needed_by: Optional[date] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    radius_km: Optional[int] = Field(None, ge=1, le=500)
    description: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_pattern: Optional[dict[str, Any]] = None


class DemandStatusUpdate(BaseModel):
    status: str = Field(
        ...,
        description="New status: open, reviewing, confirmed, fulfilled, closed, expired, cancelled",
    )


class DemandPostingRead(BaseModel):
    id: UUID
    buyer_id: UUID
    crop_id: UUID
    crop: Optional[CropBrief] = None
    variety: Optional[str] = None
    quantity_kg: float
    max_price_per_kg: Optional[float] = None
    quality_grade: Optional[str] = None
    needed_by: Optional[date] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: int
    description: Optional[str] = None
    status: str
    is_recurring: bool
    recurrence_pattern: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DemandPostingFilter(BaseModel):
    crop_id: Optional[UUID] = None
    category: Optional[str] = None
    status: Optional[str] = None
    quality_grade: Optional[str] = None
    max_price: Optional[float] = Field(None, ge=0)
    needed_by_before: Optional[date] = None
    # Geo filter
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    radius_km: Optional[float] = Field(None, gt=0, le=500)
