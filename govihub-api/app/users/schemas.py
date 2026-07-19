"""GoviHub User Schemas — Registration, profiles, preferences."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.auth.beta_schemas import TosNotAcceptedError
from app.users.phone import validate_e164_phone, validate_e164_phone_optional


class CompleteRegistrationRequest(BaseModel):
    role: str = Field(..., pattern="^(farmer|buyer|supplier)$")
    name: str = Field(..., min_length=2, max_length=255)
    phone: str = Field(..., min_length=8, max_length=16, description="Phone number in E.164 format")
    language: str = Field("si", pattern="^(si|en|ta)$")
    district: Optional[str] = None
    gn_division: Optional[str] = None
    ds_division: Optional[str] = None
    province: Optional[str] = None
    # D2: this is the second registration path. Gating it too means "accepted at
    # registration" is literally true for every new user, rather than deferred to
    # the re-acceptance modal. validate_default=True — absence is not consent.
    tos_accepted: bool = Field(default=False, validate_default=True)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return validate_e164_phone(v)

    @field_validator("tos_accepted")
    @classmethod
    def validate_tos(cls, v: bool) -> bool:
        if v is not True:
            raise TosNotAcceptedError(
                "TOS_NOT_ACCEPTED", "You must accept the Terms of Use to register"
            )
        return v


class CompleteProfileRequest(BaseModel):
    """Payload for POST /users/me/complete-profile — gate for existing NULL-phone users."""

    phone: str = Field(..., min_length=8, max_length=16)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return validate_e164_phone(v)


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
    # Terms of Use acceptance state. The frontend uses these to decide whether
    # to show the blocking re-acceptance modal (NULL or stale version = show).
    tos_accepted_at: Optional[datetime] = None
    tos_version: Optional[str] = None

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
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=16)
    language: Optional[str] = Field(None, pattern="^(si|en|ta)$")
    district: Optional[str] = None
    gn_division: Optional[str] = None
    ds_division: Optional[str] = None
    province: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip().lower()
        if not v:
            return None
        import re
        if not re.match(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("Invalid email address")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return validate_e164_phone_optional(v)


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


class RoleChangeResponse(BaseModel):
    """Success payload for PUT /users/me/role — fresh tokens carry the new role claim."""

    ok: bool = True
    role: str
    listings_deactivated: int
    access_token: str
    refresh_token: str


class RoleChangeEligibility(BaseModel):
    """State for GET /users/me/role-change-eligibility — lets the modal pre-check before confirm."""

    eligible: bool
    active_matches: int = 0
    cooldown_ends_at: Optional[datetime] = None
    reason: Optional[str] = None
