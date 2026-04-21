"""GoviHub Admin Schemas — Dashboard, user management, crop taxonomy, matches, knowledge, analytics."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------


class DashboardStats(BaseModel):
    total_users: int
    total_farmers: int
    total_buyers: int
    total_suppliers: int
    active_users_last_30d: int
    total_harvest_listings: int
    active_harvest_listings: int
    total_demand_postings: int
    active_demand_postings: int
    total_matches: int
    confirmed_matches: int
    disputed_matches: int
    total_diagnoses: int
    pending_diagnoses: int
    total_knowledge_chunks: int
    total_advisory_questions: int


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------


class AdminUserListFilter(BaseModel):
    role: Optional[str] = None
    district: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    search: Optional[str] = None
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)


class AdminUserRead(BaseModel):
    id: UUID
    email: str
    name: str
    username: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    language: str
    district: Optional[str] = None
    province: Optional[str] = None
    gn_division: Optional[str] = None
    ds_division: Optional[str] = None
    is_active: bool
    is_verified: bool
    avatar_url: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)


class ResetPasswordResponse(BaseModel):
    success: bool
    username: str


class AdminUserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    language: Optional[str] = Field(None, pattern="^(si|en|ta)$")
    district: Optional[str] = None
    province: Optional[str] = None
    gn_division: Optional[str] = None
    ds_division: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    role: Optional[str] = Field(None, pattern="^(farmer|buyer|supplier|admin)$")


class AdminUserListResponse(BaseModel):
    items: List[AdminUserRead]
    total: int
    page: int
    size: int
    pages: int


# ---------------------------------------------------------------------------
# Crop taxonomy
# ---------------------------------------------------------------------------


class CropTaxonomyCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name_en: str = Field(..., min_length=1, max_length=100)
    name_si: str = Field(..., min_length=1, max_length=100)
    name_ta: Optional[str] = Field(None, max_length=100)
    category: str = Field(..., pattern="^(vegetable|fruit|grain|pulse|spice)$")
    season: Optional[Dict[str, Any]] = None
    avg_yield_kg: Optional[float] = Field(None, gt=0)


class CropTaxonomyUpdate(BaseModel):
    name_en: Optional[str] = Field(None, min_length=1, max_length=100)
    name_si: Optional[str] = Field(None, min_length=1, max_length=100)
    name_ta: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(None, pattern="^(vegetable|fruit|grain|pulse|spice)$")
    season: Optional[Dict[str, Any]] = None
    avg_yield_kg: Optional[float] = Field(None, gt=0)


class CropTaxonomyRead(BaseModel):
    id: UUID
    code: str
    name_en: str
    name_si: str
    name_ta: Optional[str] = None
    category: str
    season: Optional[Dict[str, Any]] = None
    avg_yield_kg: Optional[float] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CropListFilter(BaseModel):
    category: Optional[str] = None
    is_active: Optional[bool] = None
    search: Optional[str] = None
    page: int = Field(1, ge=1)
    size: int = Field(50, ge=1, le=200)


class CropListResponse(BaseModel):
    items: List[CropTaxonomyRead]
    total: int
    page: int
    size: int
    pages: int


# ---------------------------------------------------------------------------
# Match management
# ---------------------------------------------------------------------------


class AdminMatchListFilter(BaseModel):
    status: Optional[str] = None
    crop_id: Optional[UUID] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    min_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)


class AdminMatchRead(BaseModel):
    id: UUID
    harvest_id: UUID
    demand_id: UUID
    score: float
    score_breakdown: Optional[Dict[str, Any]] = None
    status: str
    agreed_price_per_kg: Optional[float] = None
    agreed_quantity_kg: Optional[float] = None
    notes: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    fulfilled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminMatchListResponse(BaseModel):
    items: List[AdminMatchRead]
    total: int
    page: int
    size: int
    pages: int


class ResolveDisputeRequest(BaseModel):
    resolution: str = Field(..., min_length=5, max_length=1000)
    notes: Optional[str] = Field(None, max_length=2000)
    new_status: str = Field("completed", pattern="^(completed|dismissed)$")


class CancelMatchRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=1000)


# ---------------------------------------------------------------------------
# Knowledge base
# ---------------------------------------------------------------------------


class KnowledgeChunkListFilter(BaseModel):
    language: Optional[str] = None
    category: Optional[str] = None
    source: Optional[str] = None
    search: Optional[str] = None
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)


class KnowledgeIngestRequest(BaseModel):
    content: str = Field(..., min_length=10)
    source: str = Field(..., min_length=1, max_length=255)
    title: Optional[str] = Field(None, max_length=500)
    language: str = Field("en", pattern="^(si|en|ta)$")
    category: Optional[str] = Field(None, max_length=100)
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class KnowledgeChunkRead(BaseModel):
    id: UUID
    source: str
    title: Optional[str] = None
    content: str
    language: str
    category: Optional[str] = None
    tags: Optional[Any] = None
    metadata_: Optional[Dict[str, Any]] = Field(None, alias="metadata")
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class KnowledgeChunkListResponse(BaseModel):
    items: List[KnowledgeChunkRead]
    total: int
    page: int
    size: int
    pages: int


class KnowledgeStats(BaseModel):
    total_chunks: int
    chunks_by_language: Dict[str, int]
    chunks_by_category: Dict[str, int]
    chunks_with_embeddings: int
    chunks_without_embeddings: int


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------


class MatchAnalytics(BaseModel):
    date_from: datetime
    date_to: datetime
    total_matches: int
    matches_by_status: Dict[str, int]
    avg_match_score: float
    confirmed_rate: float
    fulfillment_rate: float
    dispute_rate: float
    matches_per_day: List[Dict[str, Any]]


class UserAnalytics(BaseModel):
    date_from: datetime
    date_to: datetime
    total_new_users: int
    new_users_by_role: Dict[str, int]
    new_users_by_district: Dict[str, int]
    active_users: int
    users_per_day: List[Dict[str, Any]]


class DiagnosisAnalytics(BaseModel):
    date_from: datetime
    date_to: datetime
    total_diagnoses: int
    diagnoses_by_status: Dict[str, int]
    avg_confidence: float
    top_diseases: List[Dict[str, Any]]
    feedback_distribution: Dict[str, int]
    diagnoses_per_day: List[Dict[str, Any]]


class SystemHealth(BaseModel):
    database_ok: bool
    total_users: int
    total_active_users: int
    recent_matches_24h: int
    recent_diagnoses_24h: int
    recent_advisory_questions_24h: int
    pending_diagnoses: int
    disputed_matches: int
    timestamp: datetime


# ---------------------------------------------------------------------------
# Broadcast notification
# ---------------------------------------------------------------------------


class BroadcastNotificationRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    body: str = Field(..., min_length=1, max_length=2000)
    target_role: Optional[str] = Field(None, pattern="^(farmer|buyer|supplier|admin)$")
    target_district: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class BroadcastNotificationResponse(BaseModel):
    queued: int
    message: str
