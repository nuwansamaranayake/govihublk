"""GoviHub Advisory Schemas — Request/response models for RAG advisory module."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AdvisoryQuestionRequest(BaseModel):
    """Request body for submitting an advisory question."""

    question: str = Field(..., min_length=5, max_length=2000, description="Farmer's question text")
    language: str = Field(
        default="si",
        pattern="^(si|en)$",
        description="Language code: 'si' for Sinhala, 'en' for English",
    )
    crop_id: Optional[UUID] = Field(
        default=None,
        description="Optional crop UUID to scope the question to a specific crop",
    )


class SourceReference(BaseModel):
    """A knowledge chunk source used to generate the answer."""

    source_name: str = Field(..., description="Name/identifier of the source document")
    relevance_score: float = Field(..., ge=0.0, le=1.0, description="Cosine similarity score")


class AdvisoryResponse(BaseModel):
    """Response returned after answering an advisory question."""

    id: UUID
    question: str
    answer: str
    sources: list[SourceReference] = Field(default_factory=list)
    source_type: str = Field(
        default="knowledge_base",
        description="'knowledge_base' when answer is from RAG, 'ai_generated' when from Gemini fallback",
    )
    language: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AdvisoryHistoryFilter(BaseModel):
    """Query parameters for filtering advisory question history."""

    language: Optional[str] = Field(
        default=None,
        pattern="^(si|en)$",
        description="Filter by language: 'si' or 'en'",
    )
    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    size: int = Field(default=20, ge=1, le=100, description="Items per page")


class AdvisoryHistoryResponse(BaseModel):
    """Paginated history of advisory questions."""

    items: list[AdvisoryResponse]
    total: int
    page: int
    size: int
    pages: int
