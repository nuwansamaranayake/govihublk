"""GoviHub Admin Router — All endpoints require admin role. Prefix: /api/v1/admin."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.schemas import (
    AdminMatchListFilter,
    AdminMatchListResponse,
    AdminMatchRead,
    AdminUserListFilter,
    AdminUserListResponse,
    AdminUserRead,
    AdminUserUpdate,
    BroadcastNotificationRequest,
    BroadcastNotificationResponse,
    CancelMatchRequest,
    CropListFilter,
    CropListResponse,
    CropTaxonomyCreate,
    CropTaxonomyRead,
    CropTaxonomyUpdate,
    DashboardStats,
    DiagnosisAnalytics,
    KnowledgeChunkListFilter,
    KnowledgeChunkListResponse,
    KnowledgeIngestRequest,
    KnowledgeChunkRead,
    KnowledgeStats,
    MatchAnalytics,
    ResetPasswordRequest,
    ResetPasswordResponse,
    ResolveDisputeRequest,
    SystemHealth,
    UserAnalytics,
)
from app.admin.service import AdminService
from app.auth.password import hash_password
from app.dependencies import get_db, get_redis, require_role

logger = structlog.get_logger()

router = APIRouter()

# Dependency shorthand — every route in this router requires admin role.
AdminRequired = Depends(require_role("admin"))


def _get_service(db: AsyncSession = Depends(get_db)) -> AdminService:
    return AdminService(db)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------


@router.get(
    "/dashboard",
    response_model=DashboardStats,
    summary="Platform-wide dashboard statistics",
)
async def get_dashboard(
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    stats = await service.get_dashboard_stats()
    return DashboardStats(**stats)


# ---------------------------------------------------------------------------
# User Management
# ---------------------------------------------------------------------------


@router.get(
    "/users",
    response_model=AdminUserListResponse,
    summary="List all users with optional filters",
)
async def list_users(
    role: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    is_verified: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    filters = AdminUserListFilter(
        role=role,
        district=district,
        is_active=is_active,
        is_verified=is_verified,
        search=search,
        page=page,
        size=size,
    )
    result = await service.list_users(filters)
    return AdminUserListResponse(
        items=[AdminUserRead.model_validate(u) for u in result["items"]],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=result["pages"],
    )


@router.get(
    "/users/{user_id}",
    response_model=AdminUserRead,
    summary="Get full user details",
)
async def get_user(
    user_id: UUID,
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    user = await service.get_user_detail(user_id)
    return AdminUserRead.model_validate(user)


@router.put(
    "/users/{user_id}",
    response_model=AdminUserRead,
    summary="Update user fields (admin)",
)
async def update_user(
    user_id: UUID,
    body: AdminUserUpdate,
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    user = await service.update_user(user_id, body)
    return AdminUserRead.model_validate(user)


@router.put(
    "/users/{user_id}/reset-password",
    response_model=ResetPasswordResponse,
    summary="Reset a user's password (admin)",
)
async def reset_user_password(
    user_id: UUID,
    body: ResetPasswordRequest,
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    user = await service.get_user_detail(user_id)
    user.password_hash = hash_password(body.new_password)
    await service.db.commit()
    await service.db.refresh(user)
    logger.info("admin_reset_password", user_id=str(user_id), username=user.username)
    return ResetPasswordResponse(success=True, username=user.username or user.email)


@router.delete(
    "/users/{user_id}",
    status_code=204,
    summary="Deactivate (soft-delete) a user",
)
async def delete_user(
    user_id: UUID,
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    await service.delete_user(user_id)


# ---------------------------------------------------------------------------
# Crop Taxonomy
# ---------------------------------------------------------------------------


@router.get(
    "/crops",
    response_model=CropListResponse,
    summary="List crop taxonomy entries",
)
async def list_crops(
    category: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    filters = CropListFilter(
        category=category,
        is_active=is_active,
        search=search,
        page=page,
        size=size,
    )
    result = await service.list_crops(filters)
    return CropListResponse(
        items=[CropTaxonomyRead.model_validate(c) for c in result["items"]],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=result["pages"],
    )


@router.post(
    "/crops",
    response_model=CropTaxonomyRead,
    status_code=201,
    summary="Create a new crop taxonomy entry",
)
async def create_crop(
    body: CropTaxonomyCreate,
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    crop = await service.create_crop(body)
    return CropTaxonomyRead.model_validate(crop)


@router.put(
    "/crops/{crop_id}",
    response_model=CropTaxonomyRead,
    summary="Update a crop taxonomy entry",
)
async def update_crop(
    crop_id: UUID,
    body: CropTaxonomyUpdate,
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    crop = await service.update_crop(crop_id, body)
    return CropTaxonomyRead.model_validate(crop)


@router.patch(
    "/crops/{crop_id}/toggle",
    response_model=CropTaxonomyRead,
    summary="Toggle crop active/inactive status",
)
async def toggle_crop(
    crop_id: UUID,
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    crop = await service.toggle_crop(crop_id)
    return CropTaxonomyRead.model_validate(crop)


# ---------------------------------------------------------------------------
# Match Management
# ---------------------------------------------------------------------------


@router.get(
    "/matches",
    response_model=AdminMatchListResponse,
    summary="List all matches (admin view)",
)
async def list_matches(
    status: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None, ge=0.0, le=1.0),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    filters = AdminMatchListFilter(
        status=status,
        min_score=min_score,
        date_from=date_from,
        date_to=date_to,
        page=page,
        size=size,
    )
    result = await service.list_matches(filters)
    return AdminMatchListResponse(
        items=[AdminMatchRead.model_validate(m) for m in result["items"]],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=result["pages"],
    )


@router.get(
    "/matches/{match_id}",
    response_model=AdminMatchRead,
    summary="Get full match details",
)
async def get_match(
    match_id: UUID,
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    match = await service.get_match_detail(match_id)
    return AdminMatchRead.model_validate(match)


@router.get(
    "/matches/{match_id}/enriched",
    summary="Get enriched match details with farmer, buyer, and crop info",
)
async def get_match_enriched(
    match_id: UUID,
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    return await service.get_match_detail_enriched(match_id)


@router.post(
    "/matches/{match_id}/resolve",
    response_model=AdminMatchRead,
    summary="Resolve a disputed match",
)
async def resolve_dispute(
    match_id: UUID,
    body: ResolveDisputeRequest,
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    match = await service.resolve_dispute(
        match_id,
        resolution=body.resolution,
        notes=body.notes,
        new_status=body.new_status,
    )
    return AdminMatchRead.model_validate(match)


@router.post(
    "/matches/{match_id}/cancel",
    response_model=AdminMatchRead,
    summary="Admin force-cancel a match",
)
async def cancel_match(
    match_id: UUID,
    body: CancelMatchRequest,
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    match = await service.cancel_match(match_id, reason=body.reason)
    return AdminMatchRead.model_validate(match)


def _knowledge_to_dict(chunk):
    """Convert KnowledgeChunk ORM to dict, working around SQLAlchemy .metadata conflict."""
    d = {c.key: getattr(chunk, c.key) for c in chunk.__table__.columns if c.key != "metadata"}
    d["metadata"] = chunk.__dict__.get("metadata", None)
    return d


# ---------------------------------------------------------------------------
# Knowledge Base
# ---------------------------------------------------------------------------


@router.get(
    "/knowledge",
    response_model=KnowledgeChunkListResponse,
    summary="List knowledge chunks",
)
async def list_knowledge(
    language: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    filters = KnowledgeChunkListFilter(
        language=language,
        category=category,
        source=source,
        search=search,
        page=page,
        size=size,
    )
    result = await service.list_knowledge_chunks(filters)
    return KnowledgeChunkListResponse(
        items=[KnowledgeChunkRead.model_validate(_knowledge_to_dict(c)) for c in result["items"]],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=result["pages"],
    )


@router.post(
    "/knowledge/ingest",
    response_model=KnowledgeChunkRead,
    status_code=201,
    summary="Ingest a new knowledge chunk (with auto-embedding)",
)
async def ingest_knowledge(
    body: KnowledgeIngestRequest,
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    chunk = await service.ingest_knowledge(
        content=body.content,
        source=body.source,
        language=body.language,
        title=body.title,
        category=body.category,
        tags=body.tags,
        metadata=body.metadata,
    )
    return KnowledgeChunkRead.model_validate(_knowledge_to_dict(chunk))


@router.delete(
    "/knowledge/{chunk_id}",
    status_code=204,
    summary="Delete a knowledge chunk",
)
async def delete_knowledge(
    chunk_id: UUID,
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    await service.delete_knowledge_chunk(chunk_id)


@router.get(
    "/knowledge/stats",
    response_model=KnowledgeStats,
    summary="Knowledge base statistics",
)
async def knowledge_stats(
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    stats = await service.get_knowledge_stats()
    return KnowledgeStats(**stats)


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

_DEFAULT_DATE_FROM = datetime(2024, 1, 1, tzinfo=timezone.utc)


@router.get(
    "/analytics/matches",
    response_model=MatchAnalytics,
    summary="Match analytics for a date range",
)
async def analytics_matches(
    date_from: datetime = Query(default=_DEFAULT_DATE_FROM),
    date_to: datetime = Query(default_factory=lambda: datetime.now(timezone.utc)),
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    data = await service.get_match_analytics(date_from, date_to)
    return MatchAnalytics(**data)


@router.get(
    "/analytics/users",
    response_model=UserAnalytics,
    summary="User registration analytics for a date range",
)
async def analytics_users(
    date_from: datetime = Query(default=_DEFAULT_DATE_FROM),
    date_to: datetime = Query(default_factory=lambda: datetime.now(timezone.utc)),
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    data = await service.get_user_analytics(date_from, date_to)
    return UserAnalytics(**data)


@router.get(
    "/analytics/diagnoses",
    response_model=DiagnosisAnalytics,
    summary="Crop diagnosis analytics for a date range",
)
async def analytics_diagnoses(
    date_from: datetime = Query(default=_DEFAULT_DATE_FROM),
    date_to: datetime = Query(default_factory=lambda: datetime.now(timezone.utc)),
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    data = await service.get_diagnosis_analytics(date_from, date_to)
    return DiagnosisAnalytics(**data)


@router.get(
    "/analytics/system",
    response_model=SystemHealth,
    summary="Real-time system health snapshot",
)
async def analytics_system(
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    data = await service.get_system_health()
    return SystemHealth(**data)


# ---------------------------------------------------------------------------
# Cache Management
# ---------------------------------------------------------------------------


@router.post(
    "/cache/clear",
    summary="Clear all Redis cache",
)
async def clear_cache(
    _admin=AdminRequired,
):
    redis = await get_redis()
    await redis.flushdb()
    logger.info("admin_cache_cleared")
    return {"message": "Cache cleared successfully"}


# ---------------------------------------------------------------------------
# Broadcast Notifications
# ---------------------------------------------------------------------------


@router.post(
    "/notifications/broadcast",
    response_model=BroadcastNotificationResponse,
    summary="Broadcast a push notification to users",
)
async def broadcast_notification(
    body: BroadcastNotificationRequest,
    _admin=AdminRequired,
    service: AdminService = Depends(_get_service),
):
    result = await service.broadcast_notification(
        title=body.title,
        body=body.body,
        target_role=body.target_role,
        target_district=body.target_district,
        data=body.data,
    )
    return BroadcastNotificationResponse(**result)
