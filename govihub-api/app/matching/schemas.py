"""GoviHub Matching Schemas — Request/response models for the matching engine."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Score breakdown
# ---------------------------------------------------------------------------

class MatchScoreBreakdown(BaseModel):
    distance_score: float = Field(..., ge=0.0, le=1.0, description="Geo-proximity score (weight 0.35)")
    quantity_score: float = Field(..., ge=0.0, le=1.0, description="Quantity overlap score (weight 0.25)")
    date_overlap_score: float = Field(..., ge=0.0, le=1.0, description="Date overlap score (weight 0.25)")
    freshness_score: float = Field(..., ge=0.0, le=1.0, description="Listing freshness score (weight 0.15)")
    total: float = Field(..., ge=0.0, le=1.0, description="Weighted total score")
    distance_km: Optional[float] = Field(None, description="Actual distance between parties in km")


# ---------------------------------------------------------------------------
# Read schemas
# ---------------------------------------------------------------------------

class MatchBrief(BaseModel):
    """Lightweight match summary for list views."""

    id: UUID
    harvest_id: UUID
    demand_id: UUID
    score: float
    status: str
    agreed_price_per_kg: Optional[float] = None
    agreed_quantity_kg: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MatchRead(BaseModel):
    """Full match detail."""

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


# ---------------------------------------------------------------------------
# List / filter
# ---------------------------------------------------------------------------

class MatchListFilter(BaseModel):
    status: Optional[str] = Field(None, description="Filter by MatchStatus value")
    harvest_id: Optional[UUID] = None
    demand_id: Optional[UUID] = None
    min_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)


# ---------------------------------------------------------------------------
# Action request schemas
# ---------------------------------------------------------------------------

class MatchAcceptRequest(BaseModel):
    agreed_price_per_kg: Optional[float] = Field(None, gt=0, description="Proposed price per kg")
    agreed_quantity_kg: Optional[float] = Field(None, gt=0, description="Proposed quantity in kg")
    notes: Optional[str] = Field(None, max_length=1000)


class MatchRejectRequest(BaseModel):
    notes: Optional[str] = Field(None, max_length=1000, description="Reason for rejection")


class MatchConfirmRequest(BaseModel):
    agreed_price_per_kg: float = Field(..., gt=0, description="Final agreed price per kg")
    agreed_quantity_kg: float = Field(..., gt=0, description="Final agreed quantity in kg")
    notes: Optional[str] = Field(None, max_length=1000)


class MatchFulfillRequest(BaseModel):
    notes: Optional[str] = Field(None, max_length=1000, description="Fulfilment notes / delivery confirmation")


class MatchDisputeRequest(BaseModel):
    notes: str = Field(..., min_length=10, max_length=2000, description="Description of the dispute")
