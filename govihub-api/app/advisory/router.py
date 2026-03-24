"""GoviHub Advisory Router — RAG-based agricultural Q&A endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.advisory.schemas import (
    AdvisoryHistoryFilter,
    AdvisoryHistoryResponse,
    AdvisoryQuestionRequest,
    AdvisoryResponse,
)
from app.advisory.service import AdvisoryService
from app.dependencies import get_db, require_role
from app.users.models import User

router = APIRouter()


@router.post("/ask", response_model=AdvisoryResponse, status_code=201)
async def ask_question(
    body: AdvisoryQuestionRequest,
    current_user: User = Depends(require_role("farmer", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Submit an agricultural question and receive an AI-generated answer.

    Searches the knowledge base using vector similarity and augments an LLM
    prompt with the most relevant reference documents.

    - **question**: The farmer's question (5–2 000 characters).
    - **language**: `si` (Sinhala, default) or `en` (English).
    - **crop_id**: Optional crop UUID to contextualise the question.

    Returns the generated answer with source references and relevance scores.
    """
    svc = AdvisoryService(db)
    response = await svc.ask_question(
        user_id=current_user.id,
        question=body.question,
        language=body.language,
        crop_id=body.crop_id,
    )
    await db.commit()
    return response


@router.get("/history", response_model=AdvisoryHistoryResponse)
async def get_history(
    language: str | None = Query(
        default=None,
        pattern="^(si|en)$",
        description="Filter by language ('si' or 'en')",
    ),
    page: int = Query(default=1, ge=1, description="Page number"),
    size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(require_role("farmer", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve paginated history of advisory questions for the current user.

    Results are ordered newest-first.
    """
    filters = AdvisoryHistoryFilter(language=language, page=page, size=size)
    svc = AdvisoryService(db)
    return await svc.get_history(user_id=current_user.id, filters=filters)


@router.get("/{question_id}", response_model=AdvisoryResponse)
async def get_advisory_detail(
    question_id: UUID,
    current_user: User = Depends(require_role("farmer", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve a single advisory question and its answer by ID.

    Returns 404 if the question does not exist or does not belong to the
    current user.
    """
    svc = AdvisoryService(db)
    return await svc.get_by_id(question_id=question_id, user_id=current_user.id)
