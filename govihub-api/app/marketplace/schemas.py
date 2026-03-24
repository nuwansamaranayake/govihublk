"""GoviHub Marketplace Schemas — Pydantic v2 models for SupplyListing."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.marketplace.models import SupplyCategory, SupplyStatus


# ---------------------------------------------------------------------------
# Nested / shared schemas
# ---------------------------------------------------------------------------

class LocationCoords(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude in decimal degrees")


class SupplierBrief(BaseModel):
    id: UUID
    name: str
    email: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# SupplyListingCreate
# ---------------------------------------------------------------------------

class SupplyListingCreate(BaseModel):
    category: SupplyCategory = Field(..., description="Supply product category")
    name: str = Field(..., min_length=2, max_length=255, description="Product name")
    name_si: Optional[str] = Field(None, max_length=255, description="Product name in Sinhala")
    description: Optional[str] = Field(None, description="Detailed product description")
    price: Optional[float] = Field(None, ge=0, description="Price per unit in LKR")
    unit: Optional[str] = Field(None, max_length=20, description="Unit of measure (e.g. kg, litre, bag)")
    stock_quantity: Optional[int] = Field(None, ge=0, description="Available stock quantity")
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    photos: Optional[list[str]] = Field(None, description="List of photo URLs")
    delivery_available: bool = Field(False, description="Whether delivery is offered")
    delivery_radius_km: Optional[int] = Field(None, ge=0, le=500, description="Delivery radius in km")

    @model_validator(mode="after")
    def validate_location(self) -> "SupplyListingCreate":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Both latitude and longitude must be provided together")
        return self

    @model_validator(mode="after")
    def validate_delivery(self) -> "SupplyListingCreate":
        if self.delivery_available and self.delivery_radius_km is None:
            raise ValueError("delivery_radius_km is required when delivery_available is True")
        return self


# ---------------------------------------------------------------------------
# SupplyListingUpdate
# ---------------------------------------------------------------------------

class SupplyListingUpdate(BaseModel):
    category: Optional[SupplyCategory] = None
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    name_si: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    price: Optional[float] = Field(None, ge=0)
    unit: Optional[str] = Field(None, max_length=20)
    stock_quantity: Optional[int] = Field(None, ge=0)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    photos: Optional[list[str]] = None
    delivery_available: Optional[bool] = None
    delivery_radius_km: Optional[int] = Field(None, ge=0, le=500)
    status: Optional[SupplyStatus] = None

    @model_validator(mode="after")
    def validate_location(self) -> "SupplyListingUpdate":
        lat_set = self.latitude is not None
        lng_set = self.longitude is not None
        if lat_set != lng_set:
            raise ValueError("Both latitude and longitude must be provided together")
        return self


# ---------------------------------------------------------------------------
# SupplyListingRead
# ---------------------------------------------------------------------------

class SupplyListingRead(BaseModel):
    id: UUID
    supplier_id: UUID
    category: SupplyCategory
    name: str
    name_si: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    unit: Optional[str] = None
    stock_quantity: Optional[int] = None
    images: Optional[Any] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    delivery_available: bool
    delivery_radius_km: Optional[int] = None
    status: SupplyStatus
    distance_km: Optional[float] = Field(None, description="Distance from search origin in km")
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# SupplySearchFilter
# ---------------------------------------------------------------------------

class SupplySearchFilter(BaseModel):
    keyword: Optional[str] = Field(None, description="Keyword search in name and description")
    category: Optional[SupplyCategory] = Field(None, description="Filter by category")
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="Origin latitude for proximity search")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="Origin longitude for proximity search")
    radius_km: float = Field(50.0, gt=0, le=500, description="Search radius in kilometres")
    min_price: Optional[float] = Field(None, ge=0)
    max_price: Optional[float] = Field(None, ge=0)
    delivery_only: bool = Field(False, description="Only listings that offer delivery")
    status: SupplyStatus = Field(SupplyStatus.active, description="Listing status filter")
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)

    @model_validator(mode="after")
    def validate_location(self) -> "SupplySearchFilter":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Both latitude and longitude must be provided together for proximity search")
        return self

    @model_validator(mode="after")
    def validate_price_range(self) -> "SupplySearchFilter":
        if self.min_price is not None and self.max_price is not None:
            if self.min_price > self.max_price:
                raise ValueError("min_price must be <= max_price")
        return self


# ---------------------------------------------------------------------------
# Paginated response
# ---------------------------------------------------------------------------

class SupplyListingPage(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[SupplyListingRead]
