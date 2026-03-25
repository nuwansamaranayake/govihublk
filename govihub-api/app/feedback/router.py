"""GoviHub Beta Feedback Router — Submit and retrieve beta feedback."""

from typing import Optional

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request
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


class FeedbackRequest(BaseModel):
    """Request body for submitting feedback."""

    message: str = Field(..., min_length=1, max_length=5000)
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    page_url: Optional[str] = Field(default=None, max_length=500)


class FeedbackResponse(BaseModel):
    """Response after submitting feedback."""

    id: str
    message: str
    rating: Optional[int] = None
    page_url: Optional[str] = None
    created_at: str

    model_config = {"from_attributes": True}


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    body: FeedbackRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit beta feedback (authenticated users only)."""
    feedback = BetaFeedback(
        user_id=current_user.id,
        message=body.message,
        rating=body.rating,
        page_url=body.page_url,
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
        created_at=feedback.created_at.isoformat(),
    )


@router.get("/admin/feedback")
async def list_feedback(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all beta feedback (admin only)."""
    if current_user.role is None or current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(
        select(BetaFeedback).order_by(BetaFeedback.created_at.desc())
    )
    feedbacks = result.scalars().all()

    return [
        {
            "id": str(f.id),
            "user_id": str(f.user_id) if f.user_id else None,
            "message": f.message,
            "rating": f.rating,
            "page_url": f.page_url,
            "user_agent": f.user_agent,
            "created_at": f.created_at.isoformat(),
        }
        for f in feedbacks
    ]
