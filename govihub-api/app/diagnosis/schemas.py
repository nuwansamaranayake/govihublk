"""GoviHub Diagnosis Schemas — Pydantic models for request/response validation."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DiagnosisBrief(BaseModel):
    """Compact representation for list views."""

    id: UUID
    disease_name: Optional[str] = None
    confidence: Optional[float] = None
    image_url: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DiagnosisResponse(BaseModel):
    """Full diagnosis result returned after processing."""

    id: UUID
    disease_name: Optional[str] = None
    confidence: Optional[float] = None
    top_predictions: Optional[list[dict[str, Any]]] = None
    treatment_advice: Optional[str] = None
    language: str = "si"
    crop_name: Optional[str] = None
    image_url: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DiagnosisHistoryFilter(BaseModel):
    """Query filters for listing diagnosis history."""

    crop_id: Optional[UUID] = None
    page: int = Field(default=1, ge=1, description="Page number")
    size: int = Field(default=20, ge=1, le=100, description="Items per page")


class DiagnosisFeedbackRequest(BaseModel):
    """Farmer feedback on a diagnosis result."""

    feedback: str = Field(
        ...,
        pattern="^(helpful|not_helpful|incorrect)$",
        description="Feedback value: helpful, not_helpful, or incorrect",
    )
