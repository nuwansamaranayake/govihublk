"""GoviHub Advertisement Router."""

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, Request, Response, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import bindparam, select, func, text, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.ads.models import AdEvent, Advertisement
from app.ads.schemas import (
    AdCreateRequest,
    AdEventRequest,
    AdPublicResponse,
    AdResponse,
    AdStatsResponse,
    AdUpdateRequest,
)
from app.database import async_session_factory
from app.dependencies import get_db, require_role

logger = structlog.get_logger()

router = APIRouter()


# ---------------------------------------------------------------------------
# Optional auth dependency
# ---------------------------------------------------------------------------

async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db),
):
    if not credentials:
        return None
    try:
        from app.auth.service import decode_access_token
        from app.users.models import User

        payload = decode_access_token(credentials.credentials)
        result = await db.execute(select(User).where(User.id == payload.sub))
        return result.scalar_one_or_none()
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Background task helpers
# ---------------------------------------------------------------------------

async def _record_impressions(ad_ids: list[uuid.UUID], user=None, request_info: dict | None = None):
    """Fire-and-forget: record impression events and bump counters."""
    async with async_session_factory() as session:
        try:
            for ad_id in ad_ids:
                event = AdEvent(
                    ad_id=ad_id,
                    user_id=user.id if user else None,
                    event_type="impression",
                    user_role=user.role.value if user and user.role else None,
                    user_district=None,
                    page_url=request_info.get("page_url") if request_info else None,
                    user_agent=request_info.get("user_agent") if request_info else None,
                    ip_hash=request_info.get("ip_hash") if request_info else None,
                )
                session.add(event)
                await session.execute(
                    update(Advertisement)
                    .where(Advertisement.id == ad_id)
                    .values(impression_count=Advertisement.impression_count + 1)
                )
            await session.commit()
        except Exception as e:
            logger.error("impression_tracking_error", error=str(e))
            await session.rollback()


# ---------------------------------------------------------------------------
# PUBLIC ENDPOINTS
# ---------------------------------------------------------------------------

@router.get("/ads/active")
async def get_active_ads(
    request: Request,
    background_tasks: BackgroundTasks,
    limit: int = Query(default=5, ge=1, le=50),
    page_context: Optional[str] = Query(default=None),
    user=Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Get active advertisements for display."""
    now = datetime.now(timezone.utc)

    query = select(Advertisement).where(
        Advertisement.is_active == True,
        Advertisement.starts_at <= now,
    ).where(
        (Advertisement.ends_at == None) | (Advertisement.ends_at > now)
    )

    # If user is authenticated, filter by target_roles
    if user and user.role:
        role_val = user.role.value
        # JSONB contains check: target_roles @> '["farmer"]'
        query = query.where(
            Advertisement.target_roles.op("@>")(
                bindparam("role_target", value=[role_val], type_=JSONB)
            )
        )

    query = query.order_by(Advertisement.display_order.asc(), func.random()).limit(limit)

    result = await db.execute(query)
    ads = result.scalars().all()

    # Fire-and-forget impression tracking
    if ads:
        ad_ids = [ad.id for ad in ads]
        request_info = {
            "page_url": page_context,
            "user_agent": request.headers.get("user-agent"),
            "ip_hash": None,
        }
        background_tasks.add_task(_record_impressions, ad_ids, user, request_info)

    return {"ads": [AdPublicResponse.model_validate(ad) for ad in ads]}


@router.post("/ads/{ad_id}/click", status_code=204)
async def track_ad_click(
    ad_id: uuid.UUID,
    request: Request,
    user=Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Track an ad click."""
    # Accept page_url from JSON body
    page_url = None
    try:
        body = await request.json()
        page_url = body.get("page_url")
    except Exception:
        pass

    event = AdEvent(
        ad_id=ad_id,
        user_id=user.id if user else None,
        event_type="click",
        user_role=user.role.value if user and user.role else None,
        user_district=None,
        page_url=page_url,
        user_agent=request.headers.get("user-agent"),
        ip_hash=None,
    )
    db.add(event)

    await db.execute(
        update(Advertisement)
        .where(Advertisement.id == ad_id)
        .values(click_count=Advertisement.click_count + 1)
    )

    return Response(status_code=204)


# ---------------------------------------------------------------------------
# ADMIN ENDPOINTS
# ---------------------------------------------------------------------------

@router.get("/admin/ads/stats/summary")
async def get_ads_stats_summary(
    _user=Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Overall advertisement statistics summary."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Total and active ads
    total_result = await db.execute(select(func.count(Advertisement.id)))
    total_ads = total_result.scalar() or 0

    active_result = await db.execute(
        select(func.count(Advertisement.id)).where(
            Advertisement.is_active == True,
            Advertisement.starts_at <= now,
            (Advertisement.ends_at == None) | (Advertisement.ends_at > now),
        )
    )
    active_ads = active_result.scalar() or 0

    # Total impressions and clicks
    totals_result = await db.execute(
        select(
            func.coalesce(func.sum(Advertisement.impression_count), 0),
            func.coalesce(func.sum(Advertisement.click_count), 0),
        )
    )
    row = totals_result.one()
    total_impressions = row[0]
    total_clicks = row[1]
    overall_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0.0

    # Today's impressions and clicks
    impressions_today_result = await db.execute(
        select(func.count(AdEvent.id)).where(
            AdEvent.event_type == "impression",
            AdEvent.created_at >= today_start,
        )
    )
    impressions_today = impressions_today_result.scalar() or 0

    clicks_today_result = await db.execute(
        select(func.count(AdEvent.id)).where(
            AdEvent.event_type == "click",
            AdEvent.created_at >= today_start,
        )
    )
    clicks_today = clicks_today_result.scalar() or 0

    # Top performing (top 5 by CTR with min 10 impressions)
    top_result = await db.execute(
        select(Advertisement).where(
            Advertisement.impression_count >= 10
        ).order_by(
            (Advertisement.click_count * 1.0 / Advertisement.impression_count).desc()
        ).limit(5)
    )
    top_ads = top_result.scalars().all()
    top_performing = [
        AdStatsResponse(
            ad_id=ad.id,
            title=ad.title,
            impression_count=ad.impression_count,
            click_count=ad.click_count,
            ctr=round((ad.click_count / ad.impression_count * 100) if ad.impression_count > 0 else 0.0, 2),
            impressions_today=0,
            clicks_today=0,
        )
        for ad in top_ads
    ]

    return {
        "total_ads": total_ads,
        "active_ads": active_ads,
        "total_impressions": total_impressions,
        "total_clicks": total_clicks,
        "overall_ctr": round(overall_ctr, 2),
        "impressions_today": impressions_today,
        "clicks_today": clicks_today,
        "top_performing": top_performing,
    }


@router.get("/admin/ads")
async def list_ads(
    is_active: Optional[bool] = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    _user=Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """List all advertisements (admin)."""
    query = select(Advertisement)
    count_query = select(func.count(Advertisement.id))

    if is_active is not None:
        query = query.where(Advertisement.is_active == is_active)
        count_query = count_query.where(Advertisement.is_active == is_active)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * limit
    query = query.order_by(Advertisement.display_order.asc(), Advertisement.created_at.desc())
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    ads = result.scalars().all()

    return {
        "items": [AdResponse.model_validate(ad) for ad in ads],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/admin/ads", status_code=201)
async def create_ad(
    image: UploadFile = File(...),
    title: str = Form(...),
    title_si: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    description_si: Optional[str] = Form(None),
    click_url: Optional[str] = Form(None),
    target_roles: Optional[str] = Form(None),
    target_districts: Optional[str] = Form(None),
    starts_at: Optional[str] = Form(None),
    ends_at: Optional[str] = Form(None),
    advertiser_name: Optional[str] = Form(None),
    advertiser_contact: Optional[str] = Form(None),
    display_order: int = Form(0),
    is_active: bool = Form(True),
    user=Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new advertisement with image upload."""
    from app.utils.storage import storage_service

    file_bytes = await image.read()
    content_type = image.content_type or "image/jpeg"
    image_url = await storage_service.upload_image(file_bytes, content_type, folder="ads")

    # Parse JSON string fields
    parsed_roles = ["farmer", "buyer", "supplier"]
    if target_roles:
        try:
            parsed_roles = json.loads(target_roles)
        except (json.JSONDecodeError, TypeError):
            pass

    parsed_districts: list[str] = []
    if target_districts:
        try:
            parsed_districts = json.loads(target_districts)
        except (json.JSONDecodeError, TypeError):
            pass

    parsed_starts_at = None
    if starts_at:
        try:
            parsed_starts_at = datetime.fromisoformat(starts_at)
        except (ValueError, TypeError):
            pass

    parsed_ends_at = None
    if ends_at:
        try:
            parsed_ends_at = datetime.fromisoformat(ends_at)
        except (ValueError, TypeError):
            pass

    ad = Advertisement(
        title=title,
        title_si=title_si,
        description=description,
        description_si=description_si,
        image_url=image_url,
        click_url=click_url,
        target_roles=parsed_roles,
        target_districts=parsed_districts,
        starts_at=parsed_starts_at or datetime.now(timezone.utc),
        ends_at=parsed_ends_at,
        is_active=is_active,
        advertiser_name=advertiser_name,
        advertiser_contact=advertiser_contact,
        display_order=display_order,
        created_by=user.id,
    )
    db.add(ad)
    await db.flush()
    await db.refresh(ad)

    return AdResponse.model_validate(ad)


@router.get("/admin/ads/{ad_id}")
async def get_ad(
    ad_id: uuid.UUID,
    _user=Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get a single advertisement by ID."""
    result = await db.execute(select(Advertisement).where(Advertisement.id == ad_id))
    ad = result.scalar_one_or_none()
    if not ad:
        from app.exceptions import NotFoundError
        raise NotFoundError(detail="Advertisement not found")
    return AdResponse.model_validate(ad)


@router.patch("/admin/ads/{ad_id}")
async def update_ad(
    ad_id: uuid.UUID,
    body: AdUpdateRequest,
    _user=Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update an advertisement."""
    result = await db.execute(select(Advertisement).where(Advertisement.id == ad_id))
    ad = result.scalar_one_or_none()
    if not ad:
        from app.exceptions import NotFoundError
        raise NotFoundError(detail="Advertisement not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(ad, key, value)

    await db.flush()
    await db.refresh(ad)

    return AdResponse.model_validate(ad)


@router.delete("/admin/ads/{ad_id}", status_code=204)
async def delete_ad(
    ad_id: uuid.UUID,
    _user=Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Delete an advertisement."""
    result = await db.execute(select(Advertisement).where(Advertisement.id == ad_id))
    ad = result.scalar_one_or_none()
    if not ad:
        from app.exceptions import NotFoundError
        raise NotFoundError(detail="Advertisement not found")

    await db.delete(ad)
    return Response(status_code=204)


@router.post("/admin/ads/{ad_id}/image")
async def upload_ad_image(
    ad_id: uuid.UUID,
    image: UploadFile = File(...),
    _user=Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Upload or replace an advertisement image."""
    from app.utils.storage import storage_service

    result = await db.execute(select(Advertisement).where(Advertisement.id == ad_id))
    ad = result.scalar_one_or_none()
    if not ad:
        from app.exceptions import NotFoundError
        raise NotFoundError(detail="Advertisement not found")

    file_bytes = await image.read()
    content_type = image.content_type or "image/jpeg"
    ad.image_url = await storage_service.upload_image(file_bytes, content_type, folder="ads")

    await db.flush()
    await db.refresh(ad)

    return AdResponse.model_validate(ad)


@router.get("/admin/ads/{ad_id}/stats")
async def get_ad_stats(
    ad_id: uuid.UUID,
    _user=Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed statistics for an advertisement."""
    result = await db.execute(select(Advertisement).where(Advertisement.id == ad_id))
    ad = result.scalar_one_or_none()
    if not ad:
        from app.exceptions import NotFoundError
        raise NotFoundError(detail="Advertisement not found")

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    thirty_days_ago = now.replace(hour=0, minute=0, second=0, microsecond=0)
    from datetime import timedelta
    thirty_days_ago = thirty_days_ago - timedelta(days=30)

    # Impressions by role
    imp_by_role_result = await db.execute(
        select(AdEvent.user_role, func.count(AdEvent.id))
        .where(AdEvent.ad_id == ad_id, AdEvent.event_type == "impression")
        .group_by(AdEvent.user_role)
    )
    impressions_by_role = {row[0] or "anonymous": row[1] for row in imp_by_role_result.all()}

    # Clicks by role
    click_by_role_result = await db.execute(
        select(AdEvent.user_role, func.count(AdEvent.id))
        .where(AdEvent.ad_id == ad_id, AdEvent.event_type == "click")
        .group_by(AdEvent.user_role)
    )
    clicks_by_role = {row[0] or "anonymous": row[1] for row in click_by_role_result.all()}

    # Impressions by day (last 30 days)
    imp_by_day_result = await db.execute(
        select(
            func.date_trunc("day", AdEvent.created_at).label("day"),
            func.count(AdEvent.id),
        )
        .where(
            AdEvent.ad_id == ad_id,
            AdEvent.event_type == "impression",
            AdEvent.created_at >= thirty_days_ago,
        )
        .group_by("day")
        .order_by("day")
    )
    impressions_by_day = {row[0].isoformat(): row[1] for row in imp_by_day_result.all()}

    # Clicks by day (last 30 days)
    click_by_day_result = await db.execute(
        select(
            func.date_trunc("day", AdEvent.created_at).label("day"),
            func.count(AdEvent.id),
        )
        .where(
            AdEvent.ad_id == ad_id,
            AdEvent.event_type == "click",
            AdEvent.created_at >= thirty_days_ago,
        )
        .group_by("day")
        .order_by("day")
    )
    clicks_by_day = {row[0].isoformat(): row[1] for row in click_by_day_result.all()}

    # Top districts
    top_districts_result = await db.execute(
        select(AdEvent.user_district, func.count(AdEvent.id))
        .where(
            AdEvent.ad_id == ad_id,
            AdEvent.user_district != None,
        )
        .group_by(AdEvent.user_district)
        .order_by(func.count(AdEvent.id).desc())
        .limit(10)
    )
    top_districts = {row[0]: row[1] for row in top_districts_result.all()}

    # Today counts
    imp_today_result = await db.execute(
        select(func.count(AdEvent.id)).where(
            AdEvent.ad_id == ad_id,
            AdEvent.event_type == "impression",
            AdEvent.created_at >= today_start,
        )
    )
    impressions_today = imp_today_result.scalar() or 0

    clicks_today_result = await db.execute(
        select(func.count(AdEvent.id)).where(
            AdEvent.ad_id == ad_id,
            AdEvent.event_type == "click",
            AdEvent.created_at >= today_start,
        )
    )
    clicks_today = clicks_today_result.scalar() or 0

    ctr = round((ad.click_count / ad.impression_count * 100) if ad.impression_count > 0 else 0.0, 2)

    return {
        "ad_id": str(ad.id),
        "title": ad.title,
        "impression_count": ad.impression_count,
        "click_count": ad.click_count,
        "ctr": ctr,
        "impressions_today": impressions_today,
        "clicks_today": clicks_today,
        "impressions_by_role": impressions_by_role,
        "clicks_by_role": clicks_by_role,
        "impressions_by_day": impressions_by_day,
        "clicks_by_day": clicks_by_day,
        "top_districts": top_districts,
    }
