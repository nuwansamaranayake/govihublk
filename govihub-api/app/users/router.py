"""GoviHub Users Router — Registration, profile CRUD, preferences."""

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_active_user, get_current_user, get_db, require_complete_profile, require_role
from app.exceptions import GoviHubException, ValidationError
from app.users.models import BuyerProfile, FarmerProfile, RoleChange, SupplierProfile, User, UserRole
from app.users.schemas import (
    BuyerProfileUpdate,
    CompleteProfileRequest,
    CompleteRegistrationRequest,
    FCMTokenUpdate,
    FarmerProfileUpdate,
    NotificationPreferenceUpdate,
    RoleChangeEligibility,
    RoleChangeResponse,
    SupplierProfileUpdate,
    UserLocationUpdate,
    UserPublic,
    UserRead,
    UserUpdate,
)
from app.users.service import UserService

logger = logging.getLogger(__name__)

router = APIRouter()

# Self-service role-change policy (see ROLE_CHANGE_AUDIT.md).
ROLE_CHANGE_COOLDOWN_DAYS = 30
# Real match_status enum after migration 007 is {proposed, accepted, completed,
# dismissed}. Non-terminal = active. ('confirmed'/'disputed' do not exist here.)
_ACTIVE_MATCH_STATUSES = ("proposed", "accepted")


def _as_utc(dt):
    """Coerce a possibly-naive datetime (e.g. from SQLite) to UTC-aware for safe arithmetic."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


async def _count_active_matches(db: AsyncSession, user: User) -> int:
    """Count the user's non-terminal matches on their current side. Suppliers have none."""
    from app.listings.models import DemandPosting, HarvestListing
    from app.matching.models import Match, MatchStatus

    active = [MatchStatus.proposed, MatchStatus.accepted]
    if user.role == UserRole.farmer:
        stmt = (
            select(func.count())
            .select_from(Match)
            .join(HarvestListing, Match.harvest_id == HarvestListing.id)
            .where(HarvestListing.farmer_id == user.id, Match.status.in_(active))
        )
    elif user.role == UserRole.buyer:
        stmt = (
            select(func.count())
            .select_from(Match)
            .join(DemandPosting, Match.demand_id == DemandPosting.id)
            .where(DemandPosting.buyer_id == user.id, Match.status.in_(active))
        )
    else:
        return 0
    return int(await db.scalar(stmt) or 0)


class ChangeRoleRequest(BaseModel):
    new_role: str

    @field_validator("new_role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = {"farmer", "buyer", "supplier"}
        if v.lower() not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(sorted(allowed))}")
        return v.lower()


@router.post("/complete-registration", response_model=UserRead)
async def complete_registration(
    body: CompleteRegistrationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign role and create profile for new user."""
    svc = UserService(db)
    user = await svc.complete_registration(current_user.id, body.model_dump())
    await db.commit()
    return user


@router.get("/me/role-change-eligibility", response_model=RoleChangeEligibility)
async def role_change_eligibility(
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Report whether the user may change role right now (30-day cooldown + active-match block).

    Lets the modal show the reason (count / date) and disable confirm BEFORE the user taps it.
    """
    if current_user.role == UserRole.admin:
        return RoleChangeEligibility(eligible=False, reason="admin")

    now = datetime.now(timezone.utc)
    last = _as_utc(current_user.last_role_change_at)
    in_cooldown = False
    cooldown_ends_at = None
    if last is not None:
        cooldown_ends_at = last + timedelta(days=ROLE_CHANGE_COOLDOWN_DAYS)
        in_cooldown = now < cooldown_ends_at

    active_matches = await _count_active_matches(db, current_user)

    if in_cooldown:
        return RoleChangeEligibility(
            eligible=False, active_matches=active_matches,
            cooldown_ends_at=cooldown_ends_at, reason="cooldown",
        )
    if active_matches > 0:
        return RoleChangeEligibility(
            eligible=False, active_matches=active_matches, reason="active_matches",
        )
    return RoleChangeEligibility(eligible=True, active_matches=0)


@router.put("/me/role", response_model=RoleChangeResponse)
async def change_role(
    body: ChangeRoleRequest,
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Self-service role change (see ROLE_CHANGE_AUDIT.md).

    Enforces a 30-day cooldown and blocks while active matches exist. KEEPS the old
    role's profile row, deactivates the old role's open listings, and reissues fresh
    tokens carrying the new role claim so the client's next request is authorised.
    """
    from app.auth.service import GoogleAuthService
    from app.listings.models import DemandPosting, HarvestListing
    from app.marketplace.models import SupplyListing
    from app.notifications.models import Notification, NotificationChannel, NotificationType

    new_role_enum = UserRole(body.new_role)

    # ---- Preconditions (before any mutation). These structured errors must NOT be
    # swallowed by the mutation try/except below, so they are raised outside it. ----
    if current_user.role == UserRole.admin:
        raise GoviHubException(
            status_code=400, error_code="ROLE_INVALID",
            detail="Admin users cannot change role.",
        )
    if current_user.role == new_role_enum:
        raise GoviHubException(
            status_code=400, error_code="ROLE_SAME",
            detail=f"You already have the '{body.new_role}' role.",
        )

    now = datetime.now(timezone.utc)
    last = _as_utc(current_user.last_role_change_at)
    if last is not None:
        next_allowed = last + timedelta(days=ROLE_CHANGE_COOLDOWN_DAYS)
        if now < next_allowed:
            raise GoviHubException(
                status_code=429, error_code="ROLE_CHANGE_COOLDOWN",
                detail="You can change your role once every 30 days.",
                details={
                    "retry_after_days": (next_allowed - now).days + 1,
                    "next_allowed_at": next_allowed.isoformat(),
                },
            )

    active_matches = await _count_active_matches(db, current_user)
    if active_matches > 0:
        raise GoviHubException(
            status_code=409, error_code="ACTIVE_MATCHES_EXIST",
            detail=f"Fulfill or cancel your {active_matches} active matches before changing role.",
            details={"count": active_matches},
        )

    # ---- Mutation (single transaction; rollback on any failure) ----
    try:
        old_role = current_user.role
        listings_deactivated = 0

        # Deactivate the current role's OPEN inventory (keep history) and dismiss its
        # active matches so the engine won't propose against cancelled listings.
        if old_role == UserRole.farmer:
            res = await db.execute(
                update(HarvestListing)
                .where(HarvestListing.farmer_id == current_user.id)
                .where(HarvestListing.status.notin_(["cancelled", "fulfilled"]))
                .values(status="cancelled")
            )
            listings_deactivated = res.rowcount or 0
            await db.execute(
                text("""
                    UPDATE matches SET status = 'dismissed'
                    WHERE harvest_id IN (SELECT id FROM harvest_listings WHERE farmer_id = :uid)
                    AND status NOT IN ('completed', 'dismissed')
                """),
                {"uid": str(current_user.id)},
            )
        elif old_role == UserRole.buyer:
            res = await db.execute(
                update(DemandPosting)
                .where(DemandPosting.buyer_id == current_user.id)
                .where(DemandPosting.status.notin_(["cancelled", "closed"]))
                .values(status="cancelled")
            )
            listings_deactivated = res.rowcount or 0
            await db.execute(
                text("""
                    UPDATE matches SET status = 'dismissed'
                    WHERE demand_id IN (SELECT id FROM demand_postings WHERE buyer_id = :uid)
                    AND status NOT IN ('completed', 'dismissed')
                """),
                {"uid": str(current_user.id)},
            )
        elif old_role == UserRole.supplier:
            res = await db.execute(
                update(SupplyListing)
                .where(SupplyListing.supplier_id == current_user.id)
                .where(SupplyListing.status == "active")
                .values(status="discontinued")
            )
            listings_deactivated = res.rowcount or 0

        # Ensure the TARGET profile row exists (create empty only if missing).
        # KEEP the old role's profile row — do NOT delete it (Decision 4).
        if new_role_enum == UserRole.farmer:
            exists = await db.scalar(
                select(FarmerProfile.id).where(FarmerProfile.user_id == current_user.id)
            )
            if not exists:
                db.add(FarmerProfile(
                    user_id=current_user.id, farm_size_acres=0,
                    primary_crops=[], irrigation_type="rainfed",
                ))
        elif new_role_enum == UserRole.buyer:
            exists = await db.scalar(
                select(BuyerProfile.id).where(BuyerProfile.user_id == current_user.id)
            )
            if not exists:
                db.add(BuyerProfile(
                    user_id=current_user.id, business_name="", business_type="",
                    preferred_districts=[], preferred_radius_km=50,
                ))
        elif new_role_enum == UserRole.supplier:
            exists = await db.scalar(
                select(SupplierProfile.id).where(SupplierProfile.user_id == current_user.id)
            )
            if not exists:
                db.add(SupplierProfile(
                    user_id=current_user.id, business_name="",
                    categories=[], coverage_area=[],
                ))

        # Flip role + stamp cooldown.
        current_user.role = new_role_enum
        current_user.last_role_change_at = now
        await db.flush()

        # Audit row + in-app confirmation.
        db.add(RoleChange(
            user_id=current_user.id,
            old_role=old_role.value,
            new_role=new_role_enum.value,
            listings_deactivated=listings_deactivated,
        ))
        db.add(Notification(
            user_id=current_user.id,
            type=NotificationType.system_message,
            channel=NotificationChannel.in_app,
            title="Role changed",
            body=(
                f"Your role is now {new_role_enum.value}. "
                f"{listings_deactivated} open listing(s) from your previous role were deactivated."
            ),
            is_read=False,
            is_sent=True,
        ))

        # Revoke old sessions, mint fresh tokens carrying the NEW role claim.
        await GoogleAuthService.revoke_all_user_tokens(db, current_user.id)
        token_resp, raw_refresh = await GoogleAuthService.create_tokens(db, current_user)

        await db.commit()

        logger.info(
            "User %s changed role from %s to %s (deactivated %d listings)",
            current_user.id, old_role.value, new_role_enum.value, listings_deactivated,
        )

        return RoleChangeResponse(
            ok=True,
            role=new_role_enum.value,
            listings_deactivated=listings_deactivated,
            access_token=token_resp.access_token,
            refresh_token=raw_refresh,
        )

    except GoviHubException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error("Role change failed for user %s: %s", current_user.id, str(e))
        raise HTTPException(status_code=400, detail=f"Role change failed: {str(e)}")


@router.get("/me", response_model=UserRead)
async def get_current_profile(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user full profile. Always accessible (no profile gate)."""
    svc = UserService(db)
    return await svc.get_user(current_user.id)


@router.post("/me/complete-profile", response_model=UserRead)
async def complete_profile(
    body: CompleteProfileRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Blocking gate: captures the phone number for non-admin users who registered before it was required.

    Admins should update their phone via PUT /users/me instead (they are exempt from the gate).
    """
    if current_user.role == UserRole.admin:
        raise HTTPException(status_code=400, detail="Admins do not use this endpoint")
    current_user.phone = body.phone
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.put("/me", response_model=UserRead)
async def update_current_user(
    body: UserUpdate,
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Update basic user fields.

    Non-admin users cannot clear their phone (required field for marketplace contact).
    """
    payload = body.model_dump(exclude_unset=True)

    if "phone" in payload and current_user.role != UserRole.admin:
        new_phone = payload["phone"]
        if new_phone is None or (isinstance(new_phone, str) and not new_phone.strip()):
            raise ValidationError(
                detail="Phone number is required for non-admin users and cannot be cleared.",
            )

    svc = UserService(db)
    user = await svc.update_user(current_user.id, payload)
    await db.commit()
    return user


@router.put("/me/location")
async def update_location(
    body: UserLocationUpdate,
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Update GPS location."""
    svc = UserService(db)
    await svc.update_location(current_user.id, body.latitude, body.longitude)
    await db.commit()
    return {"message": "Location updated"}


@router.get("/{user_id}", response_model=UserPublic)
async def get_user_public(
    user_id: UUID,
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Get public profile of any user."""
    svc = UserService(db)
    return await svc.get_user_public(user_id)


@router.put("/me/farmer-profile")
async def update_farmer_profile(
    body: FarmerProfileUpdate,
    current_user: User = Depends(require_role("farmer", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update farmer profile fields."""
    svc = UserService(db)
    profile = await svc.update_farmer_profile(current_user.id, body.model_dump(exclude_unset=True))
    await db.commit()
    return {"message": "Farmer profile updated"}


@router.put("/me/buyer-profile")
async def update_buyer_profile(
    body: BuyerProfileUpdate,
    current_user: User = Depends(require_role("buyer", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update buyer profile fields."""
    svc = UserService(db)
    profile = await svc.update_buyer_profile(current_user.id, body.model_dump(exclude_unset=True))
    await db.commit()
    return {"message": "Buyer profile updated"}


@router.put("/me/supplier-profile")
async def update_supplier_profile(
    body: SupplierProfileUpdate,
    current_user: User = Depends(require_role("supplier", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update supplier profile fields."""
    svc = UserService(db)
    profile = await svc.update_supplier_profile(current_user.id, body.model_dump(exclude_unset=True))
    await db.commit()
    return {"message": "Supplier profile updated"}


@router.put("/me/fcm-token")
async def update_fcm_token(
    body: FCMTokenUpdate,
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Register FCM token for push notifications."""
    # Store in Redis for fast lookup
    from app.dependencies import get_redis
    redis = await get_redis()
    await redis.set(f"fcm:{current_user.id}", body.fcm_token, ex=86400 * 30)
    return {"message": "FCM token registered"}


@router.get("/me/preferences")
async def get_preferences(
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Get notification preferences for the current user."""
    from sqlalchemy import select
    from app.notifications.models import NotificationPreference

    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == current_user.id
        )
    )
    pref = result.scalar_one_or_none()
    if not pref:
        # Return defaults
        return {
            "push_enabled": True,
            "sms_enabled": True,
            "match_alerts": True,
            "weather_alerts": True,
            "price_alerts": True,
            "quiet_hours_start": None,
            "quiet_hours_end": None,
        }
    return {
        "push_enabled": pref.push_enabled,
        "sms_enabled": pref.sms_enabled,
        "match_alerts": pref.match_alerts,
        "weather_alerts": pref.weather_alerts,
        "price_alerts": pref.price_alerts,
        "quiet_hours_start": str(pref.quiet_hours_start) if pref.quiet_hours_start else None,
        "quiet_hours_end": str(pref.quiet_hours_end) if pref.quiet_hours_end else None,
    }


@router.put("/me/preferences")
async def update_preferences(
    body: NotificationPreferenceUpdate,
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Update notification preferences."""
    from sqlalchemy import select
    from app.notifications.models import NotificationPreference

    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == current_user.id
        )
    )
    pref = result.scalar_one_or_none()
    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)

    for key, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(pref, key, value)

    await db.commit()
    return {"message": "Preferences updated"}


# ── Crop Selection CRUD ────────────────────────────────────────────

@router.get("/me/crops")
async def list_my_crops(
    current_user: User = Depends(require_role("farmer", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """List farmer's selected crops with profile metadata."""
    from app.weather.models import FarmerCropSelection
    from app.weather.crop_profiles import CROP_WEATHER_PROFILES

    result = await db.execute(
        select(FarmerCropSelection)
        .where(FarmerCropSelection.user_id == current_user.id)
        .order_by(FarmerCropSelection.created_at)
    )
    selections = result.scalars().all()

    crops = []
    for s in selections:
        profile = CROP_WEATHER_PROFILES.get(s.crop_type, {})
        crops.append({
            "crop_type": s.crop_type,
            "name_si": profile.get("name_si", s.crop_type),
            "name_en": profile.get("name_en", s.crop_type),
            "growth_stage": s.growth_stage,
            "area_hectares": float(s.area_hectares) if s.area_hectares else None,
            "is_primary": s.is_primary,
        })

    return {"crops": crops, "count": len(crops)}


@router.post("/me/crops", status_code=201)
async def add_crop(
    body: dict,
    current_user: User = Depends(require_role("farmer", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Add a crop to farmer's selection."""
    from app.weather.models import FarmerCropSelection
    from app.weather.schemas import VALID_CROP_TYPES, VALID_GROWTH_STAGES
    from app.weather.crop_profiles import CROP_WEATHER_PROFILES

    crop_type = body.get("crop_type", "").strip().lower()
    if crop_type not in VALID_CROP_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid crop type. Must be one of: {', '.join(VALID_CROP_TYPES)}",
        )

    growth_stage = body.get("growth_stage", "vegetative")
    if growth_stage and growth_stage not in VALID_GROWTH_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid growth stage. Must be one of: {', '.join(VALID_GROWTH_STAGES)}")

    # Check duplicate
    existing = await db.execute(
        select(FarmerCropSelection).where(
            FarmerCropSelection.user_id == current_user.id,
            FarmerCropSelection.crop_type == crop_type,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Crop already selected")

    area = body.get("area_hectares")
    is_primary = body.get("is_primary", False)

    selection = FarmerCropSelection(
        user_id=current_user.id,
        crop_type=crop_type,
        growth_stage=growth_stage,
        area_hectares=area,
        is_primary=is_primary,
    )
    db.add(selection)
    await db.flush()

    profile = CROP_WEATHER_PROFILES.get(crop_type, {})
    return {
        "crop_type": crop_type,
        "name_si": profile.get("name_si", crop_type),
        "name_en": profile.get("name_en", crop_type),
        "growth_stage": growth_stage,
        "area_hectares": float(area) if area else None,
        "is_primary": is_primary,
        "message": "Crop added successfully",
    }


@router.put("/me/crops/{crop_type}")
async def update_crop(
    crop_type: str,
    body: dict,
    current_user: User = Depends(require_role("farmer", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update growth stage or area for a selected crop."""
    from app.weather.models import FarmerCropSelection
    from app.weather.schemas import VALID_GROWTH_STAGES

    result = await db.execute(
        select(FarmerCropSelection).where(
            FarmerCropSelection.user_id == current_user.id,
            FarmerCropSelection.crop_type == crop_type,
        )
    )
    selection = result.scalar_one_or_none()
    if not selection:
        raise HTTPException(status_code=404, detail="Crop not in your selection")

    if "growth_stage" in body:
        if body["growth_stage"] not in VALID_GROWTH_STAGES:
            raise HTTPException(status_code=400, detail=f"Invalid growth stage. Must be one of: {', '.join(VALID_GROWTH_STAGES)}")
        selection.growth_stage = body["growth_stage"]

    if "area_hectares" in body:
        selection.area_hectares = body["area_hectares"]

    if "is_primary" in body:
        selection.is_primary = body["is_primary"]

    await db.flush()
    return {
        "crop_type": crop_type,
        "growth_stage": selection.growth_stage,
        "area_hectares": float(selection.area_hectares) if selection.area_hectares else None,
        "is_primary": selection.is_primary,
        "message": "Updated",
    }


@router.delete("/me/crops/{crop_type}")
async def remove_crop(
    crop_type: str,
    current_user: User = Depends(require_role("farmer", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Remove a crop from farmer's selection."""
    from app.weather.models import FarmerCropSelection

    result = await db.execute(
        select(FarmerCropSelection).where(
            FarmerCropSelection.user_id == current_user.id,
            FarmerCropSelection.crop_type == crop_type,
        )
    )
    selection = result.scalar_one_or_none()
    if not selection:
        raise HTTPException(status_code=404, detail="Crop not in your selection")

    await db.delete(selection)
    await db.flush()
    return {"message": "Crop removed", "crop_type": crop_type}


@router.get("/me/crops/available")
async def list_available_crops(
    current_user: User = Depends(require_role("farmer", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """List all 8 crops with selection status for this farmer."""
    from app.weather.models import FarmerCropSelection
    from app.weather.crop_profiles import CROP_WEATHER_PROFILES

    result = await db.execute(
        select(FarmerCropSelection).where(FarmerCropSelection.user_id == current_user.id)
    )
    selections = {s.crop_type: s for s in result.scalars().all()}

    crops = []
    for key, profile in CROP_WEATHER_PROFILES.items():
        sel = selections.get(key)
        crops.append({
            "crop_type": key,
            "name_si": profile.get("name_si", key),
            "name_en": profile.get("name_en", key),
            "selected": sel is not None,
            "growth_stage": sel.growth_stage if sel else None,
            "area_hectares": float(sel.area_hectares) if sel and sel.area_hectares else None,
        })

    return {"crops": crops}


@router.delete("/me")
async def deactivate_account(
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate (soft delete) user account."""
    svc = UserService(db)
    await svc.deactivate_user(current_user.id)
    await db.commit()
    return {"message": "Account deactivated"}
