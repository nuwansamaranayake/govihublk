"""GoviHub Diagnosis Router — Image upload, history, detail, feedback endpoints."""

import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role
from app.diagnosis.schemas import (
    DiagnosisBrief,
    DiagnosisFeedbackRequest,
    DiagnosisResponse,
)
from app.diagnosis.service import diagnosis_service
from app.utils.pagination import PaginationMeta, PaginatedResponse

router = APIRouter()

# Only farmers may upload and view diagnoses
_farmer_only = require_role("farmer")


def _to_response(record) -> DiagnosisResponse:
    """Map a CropDiagnosis ORM instance to the full response schema."""
    result = record.diagnosis_result or {}

    crop_name: Optional[str] = None
    if record.crop:
        crop_name = record.crop.name_en

    return DiagnosisResponse(
        id=record.id,
        disease_name=record.disease_name,
        confidence=record.confidence,
        top_predictions=result.get("top_predictions") if "top_predictions" in result else None,
        treatment_advice=record.treatment_advice,
        language=record.language,
        crop_name=crop_name,
        image_url=record.image_url,
        status=record.status.value,
        created_at=record.created_at,
        # Gemini Vision fields
        crop_detected=result.get("crop_detected"),
        description=result.get("description"),
        treatment=result.get("treatment"),
        prevention=result.get("prevention"),
        severity=result.get("severity"),
        advice_sinhala=result.get("advice_sinhala"),
        consult_expert=result.get("consult_expert", False),
    )


def _to_brief(record) -> DiagnosisBrief:
    """Map a CropDiagnosis ORM instance to the brief schema."""
    return DiagnosisBrief(
        id=record.id,
        disease_name=record.disease_name,
        confidence=record.confidence,
        image_url=record.image_url,
        created_at=record.created_at,
    )


@router.post(
    "/upload",
    response_model=DiagnosisResponse,
    status_code=201,
    summary="Upload crop image for disease diagnosis",
    description=(
        "Accepts a JPEG or PNG image (<=10 MB) and an optional crop_id or crop_type. "
        "Sends the image to Gemini 2.0 Flash for diagnosis, generates Sinhala treatment advice, "
        "and returns the full diagnosis result."
    ),
)
async def upload_diagnosis(
    image: UploadFile = File(..., description="Crop image (JPEG or PNG, max 10 MB)"),
    crop_id: Optional[UUID] = Form(None, description="Optional crop taxonomy UUID"),
    crop_type: Optional[str] = Form(None, description="Optional free-text crop name (e.g. 'rice', 'tomato')"),
    current_user=Depends(_farmer_only),
    db: AsyncSession = Depends(get_db),
):
    """Upload a crop image and receive a disease diagnosis."""
    record = await diagnosis_service.diagnose(
        db=db,
        farmer_id=current_user.id,
        image_file=image,
        crop_id=crop_id,
        crop_type=crop_type,
    )
    return _to_response(record)


@router.get(
    "/history",
    response_model=PaginatedResponse,
    summary="Get paginated diagnosis history",
    description="Returns the authenticated farmer's diagnosis history, newest first.",
)
async def get_history(
    crop_id: Optional[UUID] = Query(None, description="Filter by crop taxonomy UUID"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user=Depends(_farmer_only),
    db: AsyncSession = Depends(get_db),
):
    """List the farmer's diagnosis history with optional crop filter."""
    records, total = await diagnosis_service.list_diagnosis_history(
        db=db,
        farmer_id=current_user.id,
        crop_id=crop_id,
        page=page,
        size=size,
    )

    pages = math.ceil(total / size) if size > 0 else 0
    return PaginatedResponse(
        data=[_to_brief(r) for r in records],
        meta=PaginationMeta(page=page, size=size, total=total, pages=pages),
    )


@router.get(
    "/{diagnosis_id}",
    response_model=DiagnosisResponse,
    summary="Get full diagnosis detail",
    description="Returns the full diagnosis result for a specific record owned by the current farmer.",
)
async def get_diagnosis(
    diagnosis_id: UUID,
    current_user=Depends(_farmer_only),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a single diagnosis by ID."""
    record = await diagnosis_service.get_diagnosis(
        db=db,
        diagnosis_id=diagnosis_id,
        farmer_id=current_user.id,
    )
    return _to_response(record)


@router.post(
    "/{diagnosis_id}/feedback",
    response_model=DiagnosisResponse,
    summary="Submit feedback on a diagnosis",
    description="Allows the farmer to rate a diagnosis as helpful, not_helpful, or incorrect.",
)
async def submit_feedback(
    diagnosis_id: UUID,
    body: DiagnosisFeedbackRequest,
    current_user=Depends(_farmer_only),
    db: AsyncSession = Depends(get_db),
):
    """Record farmer feedback for a completed diagnosis."""
    record = await diagnosis_service.submit_feedback(
        db=db,
        diagnosis_id=diagnosis_id,
        farmer_id=current_user.id,
        feedback=body.feedback,
    )
    return _to_response(record)
