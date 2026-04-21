"""GoviHub Advertisement Schemas."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AdCreateRequest(BaseModel):
    title: str = Field(..., max_length=255)
    title_si: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    description_si: Optional[str] = None
    click_url: Optional[str] = None
    target_roles: list[str] = Field(default=["farmer", "buyer", "supplier"])
    target_districts: list[str] = Field(default=[])
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool = True
    advertiser_name: Optional[str] = Field(None, max_length=255)
    advertiser_contact: Optional[str] = Field(None, max_length=255)
    display_order: int = 0


class AdUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    title_si: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    description_si: Optional[str] = None
    click_url: Optional[str] = None
    target_roles: Optional[list[str]] = None
    target_districts: Optional[list[str]] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: Optional[bool] = None
    advertiser_name: Optional[str] = Field(None, max_length=255)
    advertiser_contact: Optional[str] = Field(None, max_length=255)
    display_order: Optional[int] = None


class AdEventRequest(BaseModel):
    ad_id: uuid.UUID
    event_type: str = Field(..., pattern="^(impression|click)$")
    page_url: Optional[str] = None


class AdResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    title: str
    title_si: Optional[str] = None
    description: Optional[str] = None
    description_si: Optional[str] = None
    image_url: str
    click_url: Optional[str] = None
    target_roles: list[str] = []
    target_districts: list[str] = []
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool = True
    advertiser_name: Optional[str] = None
    advertiser_contact: Optional[str] = None
    display_order: int = 0
    impression_count: int = 0
    click_count: int = 0
    created_by: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime


class AdPublicResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    title: str
    title_si: Optional[str] = None
    description: Optional[str] = None
    description_si: Optional[str] = None
    image_url: str
    click_url: Optional[str] = None


class AdStatsResponse(BaseModel):
    ad_id: uuid.UUID
    title: str
    impression_count: int = 0
    click_count: int = 0
    ctr: float = 0.0
    impressions_today: int = 0
    clicks_today: int = 0
