"""GoviHub Beta Feedback Router — Submit and retrieve beta feedback."""

import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.beta_router import get_current_user
from app.config import settings
from app.database import get_db
from app.feedback.models import BetaFeedback
from app.users.models import User

logger = structlog.get_logger()

router = APIRouter(tags=["feedback"])


def detect_language(text: str) -> str:
    """Auto-detect language from text. Returns 'si' for Sinhala, 'en' otherwise."""
    sinhala_pattern = re.compile(r'[\u0D80-\u0DFF]')
    return "si" if sinhala_pattern.search(text) else "en"


class FeedbackRequest(BaseModel):
    """Request body for submitting feedback."""

    message: str = Field(..., min_length=1, max_length=5000)
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    page_url: Optional[str] = Field(default=None, max_length=500)
    category: str = Field(default="general")


class FeedbackResponse(BaseModel):
    """Response after submitting feedback."""

    id: str
    message: str
    rating: Optional[int] = None
    page_url: Optional[str] = None
    category: str = "general"
    language: Optional[str] = None
    status: str = "new"
    created_at: str

    model_config = {"from_attributes": True}


class FeedbackUpdateRequest(BaseModel):
    """Request body for admin updating feedback."""

    status: Optional[str] = Field(default=None)
    priority: Optional[str] = Field(default=None)
    admin_notes: Optional[str] = Field(default=None)


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    body: FeedbackRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit beta feedback (authenticated users only)."""
    detected_lang = detect_language(body.message)

    feedback = BetaFeedback(
        user_id=current_user.id,
        message=body.message,
        rating=body.rating,
        page_url=body.page_url,
        category=body.category,
        language=detected_lang,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(feedback)
    await db.flush()

    logger.info("beta_feedback_submitted", user_id=str(current_user.id), feedback_id=str(feedback.id))

    return FeedbackResponse(
        id=str(feedback.id),
        message=feedback.message,
        rating=feedback.rating,
        page_url=feedback.page_url,
        category=feedback.category,
        language=feedback.language,
        status=feedback.status,
        created_at=feedback.created_at.isoformat(),
    )


@router.get("/admin/feedback")
async def list_feedback(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    category: Optional[str] = Query(default=None, description="Filter by category"),
    status: Optional[str] = Query(default=None, description="Filter by status"),
    language: Optional[str] = Query(default=None, description="Filter by language"),
    days: Optional[int] = Query(default=None, description="Filter by last N days"),
):
    """List all beta feedback (admin only) with optional filters."""
    if current_user.role is None or current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    query = select(BetaFeedback).order_by(BetaFeedback.created_at.desc())

    if category:
        query = query.where(BetaFeedback.category == category)
    if status:
        query = query.where(BetaFeedback.status == status)
    if language:
        query = query.where(BetaFeedback.language == language)
    if days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.where(BetaFeedback.created_at >= cutoff)

    result = await db.execute(query)
    feedbacks = result.scalars().all()

    return [
        {
            "id": str(f.id),
            "user_id": str(f.user_id) if f.user_id else None,
            "message": f.message,
            "rating": f.rating,
            "page_url": f.page_url,
            "category": f.category,
            "language": f.language,
            "status": f.status,
            "priority": f.priority,
            "admin_notes": f.admin_notes,
            "user_agent": f.user_agent,
            "created_at": f.created_at.isoformat(),
        }
        for f in feedbacks
    ]


@router.patch("/admin/feedback/{feedback_id}")
async def update_feedback(
    feedback_id: str,
    body: FeedbackUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update feedback status, priority, or admin notes (admin only)."""
    if current_user.role is None or current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(
        select(BetaFeedback).where(BetaFeedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    if body.status is not None:
        feedback.status = body.status
    if body.priority is not None:
        feedback.priority = body.priority
    if body.admin_notes is not None:
        feedback.admin_notes = body.admin_notes

    await db.flush()

    logger.info(
        "feedback_updated_by_admin",
        feedback_id=feedback_id,
        admin_id=str(current_user.id),
    )

    return {
        "id": str(feedback.id),
        "status": feedback.status,
        "priority": feedback.priority,
        "admin_notes": feedback.admin_notes,
    }
