"""GoviHub User Schemas — Registration, profiles, preferences."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CompleteRegistrationRequest(BaseModel):
    role: str = Field(..., pattern="^(farmer|buyer|supplier)$")
    name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    language: str = Field("si", pattern="^(si|en|ta)$")
    district: Optional[str] = None
    gn_division: Optional[str] = None
    ds_division: Optional[str] = None
    province: Optional[str] = None


class UserRead(BaseModel):
    id: UUID
    email: str
    name: str
    role: Optional[str] = None
    phone: Optional[str] = None
    language: str
    district: Optional[str] = None
    province: Optional[str] = None
    avatar_url: Optional[str] = None
    is_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserPublic(BaseModel):
    id: UUID
    name: str
    role: Optional[str] = None
    district: Optional[str] = None
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    language: Optional[str] = Field(None, pattern="^(si|en|ta)$")
    district: Optional[str] = None
    gn_division: Optional[str] = None
    ds_division: Optional[str] = None
    province: Optional[str] = None


class UserLocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class FarmerProfileRead(BaseModel):
    id: UUID
    farm_size_acres: Optional[float] = None
    primary_crops: Optional[list] = None
    irrigation_type: Optional[str] = None
    cooperative: Optional[str] = None

    model_config = {"from_attributes": True}


class FarmerProfileUpdate(BaseModel):
    farm_size_acres: Optional[float] = None
    primary_crops: Optional[list] = None
    irrigation_type: Optional[str] = None
    cooperative: Optional[str] = None


class BuyerProfileRead(BaseModel):
    id: UUID
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    preferred_districts: Optional[list] = None
    preferred_radius_km: int = 50

    model_config = {"from_attributes": True}


class BuyerProfileUpdate(BaseModel):
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    preferred_districts: Optional[list] = None
    preferred_radius_km: Optional[int] = None


class SupplierProfileRead(BaseModel):
    id: UUID
    business_name: Optional[str] = None
    categories: Optional[list] = None
    coverage_area: Optional[list] = None
    contact_phone: Optional[str] = None
    contact_whatsapp: Optional[str] = None

    model_config = {"from_attributes": True}


class SupplierProfileUpdate(BaseModel):
    business_name: Optional[str] = None
    categories: Optional[list] = None
    coverage_area: Optional[list] = None
    contact_phone: Optional[str] = None
    contact_whatsapp: Optional[str] = None


class FCMTokenUpdate(BaseModel):
    fcm_token: str


class NotificationPreferenceUpdate(BaseModel):
    push_enabled: Optional[bool] = None
    sms_enabled: Optional[bool] = None
    match_alerts: Optional[bool] = None
    weather_alerts: Optional[bool] = None
    price_alerts: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
