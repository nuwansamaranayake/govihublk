"""GoviHub Users Router — Registration, profile CRUD, preferences."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import delete, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_active_user, get_current_user, get_db, require_complete_profile, require_role
from app.exceptions import ValidationError
from app.users.models import BuyerProfile, FarmerProfile, SupplierProfile, User, UserRole
from app.users.schemas import (
    BuyerProfileUpdate,
    CompleteProfileRequest,
    CompleteRegistrationRequest,
    FCMTokenUpdate,
    FarmerProfileUpdate,
    NotificationPreferenceUpdate,
    SupplierProfileUpdate,
    UserLocationUpdate,
    UserPublic,
    UserRead,
    UserUpdate,
)
from app.users.service import UserService

logger = logging.getLogger(__name__)

router = APIRouter()


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


@router.put("/me/role", response_model=UserRead)
async def change_role(
    body: ChangeRoleRequest,
    current_user: User = Depends(require_complete_profile),
    db: AsyncSession = Depends(get_db),
):
    """Change user's role. Deactivates old role data, creates new profile."""
    from app.listings.models import DemandPosting, HarvestListing
    from app.marketplace.models import SupplyListing

    new_role_enum = UserRole(body.new_role)

    # 1. Validate new role != current role
    if current_user.role == new_role_enum:
        raise ValidationError(
            detail=f"You already have the '{body.new_role}' role",
        )

    # Admin cannot change role via this endpoint
    if current_user.role == UserRole.admin:
        raise ValidationError(detail="Admin users cannot change role via this endpoint")

    try:
        # 2. Delete old role-specific profile
        if current_user.role == UserRole.farmer:
            await db.execute(
                delete(FarmerProfile).where(FarmerProfile.user_id == current_user.id)
            )
        elif current_user.role == UserRole.buyer:
            await db.execute(
                delete(BuyerProfile).where(BuyerProfile.user_id == current_user.id)
            )
        elif current_user.role == UserRole.supplier:
            await db.execute(
                delete(SupplierProfile).where(SupplierProfile.user_id == current_user.id)
            )

        # 3. Deactivate old role-specific data (preserve history, don't delete)
        if current_user.role == UserRole.farmer:
            # Cancel active harvest listings
            await db.execute(
                update(HarvestListing)
                .where(HarvestListing.farmer_id == current_user.id)
                .where(HarvestListing.status.notin_(["cancelled", "fulfilled"]))
                .values(status="cancelled")
            )
            # Dismiss active matches linked to farmer's harvest listings.
            # NOTE: match_status after migration 007 is {proposed, accepted,
            # completed, dismissed} — 'cancelled'/'fulfilled' no longer exist.
            await db.execute(
                text("""
                    UPDATE matches SET status = 'dismissed'
                    WHERE harvest_id IN (SELECT id FROM harvest_listings WHERE farmer_id = :uid)
                    AND status NOT IN ('completed', 'dismissed')
                """),
                {"uid": str(current_user.id)},
            )
        elif current_user.role == UserRole.buyer:
            # Cancel active demand postings
            await db.execute(
                update(DemandPosting)
                .where(DemandPosting.buyer_id == current_user.id)
                .where(DemandPosting.status.notin_(["cancelled", "closed"]))
                .values(status="cancelled")
            )
            # Dismiss active matches linked to buyer's demand postings.
            # See note above re migration 007 enum change.
            await db.execute(
                text("""
                    UPDATE matches SET status = 'dismissed'
                    WHERE demand_id IN (SELECT id FROM demand_postings WHERE buyer_id = :uid)
                    AND status NOT IN ('completed', 'dismissed')
                """),
                {"uid": str(current_user.id)},
            )
        elif current_user.role == UserRole.supplier:
            # Discontinue active supply listings
            await db.execute(
                update(SupplyListing)
                .where(SupplyListing.supplier_id == current_user.id)
                .where(SupplyListing.status == "active")
                .values(status="discontinued")
            )

        # 4. Create new role profile
        if new_role_enum == UserRole.farmer:
            db.add(FarmerProfile(
                user_id=current_user.id,
                farm_size_acres=0,
                primary_crops=[],
                irrigation_type="rainfed",
            ))
        elif new_role_enum == UserRole.buyer:
            db.add(BuyerProfile(
                user_id=current_user.id,
                business_name="",
                business_type="",
                preferred_districts=[],
                preferred_radius_km=50,
            ))
        elif new_role_enum == UserRole.supplier:
            db.add(SupplierProfile(
                user_id=current_user.id,
                business_name="",
                categories=[],
                coverage_area=[],
            ))

        # 5. Update user role
        old_role = current_user.role.value if current_user.role else "none"
        current_user.role = new_role_enum
        await db.commit()
        await db.refresh(current_user)

        logger.info(
            "User %s changed role from %s to %s",
            current_user.id,
            old_role,
            body.new_role,
        )

        return current_user

    except ValidationError:
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
