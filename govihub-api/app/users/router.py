"""GoviHub Users Router — Registration, profile CRUD, preferences."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import delete, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_active_user, get_current_user, get_db, require_role
from app.exceptions import ValidationError
from app.users.models import BuyerProfile, FarmerProfile, SupplierProfile, User, UserRole
from app.users.schemas import (
    BuyerProfileUpdate,
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
    current_user: User = Depends(get_current_active_user),
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
            # Cancel active matches linked to farmer's harvest listings
            await db.execute(
                text("""
                    UPDATE matches SET status = 'cancelled'
                    WHERE harvest_id IN (SELECT id FROM harvest_listings WHERE farmer_id = :uid)
                    AND status NOT IN ('fulfilled', 'cancelled')
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
            # Cancel active matches linked to buyer's demand postings
            await db.execute(
                text("""
                    UPDATE matches SET status = 'cancelled'
                    WHERE demand_id IN (SELECT id FROM demand_postings WHERE buyer_id = :uid)
                    AND status NOT IN ('fulfilled', 'cancelled')
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
    """Get current user full profile."""
    svc = UserService(db)
    return await svc.get_user(current_user.id)


@router.put("/me", response_model=UserRead)
async def update_current_user(
    body: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update basic user fields."""
    svc = UserService(db)
    user = await svc.update_user(current_user.id, body.model_dump(exclude_unset=True))
    await db.commit()
    return user


@router.put("/me/location")
async def update_location(
    body: UserLocationUpdate,
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Register FCM token for push notifications."""
    # Store in Redis for fast lookup
    from app.dependencies import get_redis
    redis = await get_redis()
    await redis.set(f"fcm:{current_user.id}", body.fcm_token, ex=86400 * 30)
    return {"message": "FCM token registered"}


@router.put("/me/preferences")
async def update_preferences(
    body: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_active_user),
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


@router.delete("/me")
async def deactivate_account(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate (soft delete) user account."""
    svc = UserService(db)
    await svc.deactivate_user(current_user.id)
    await db.commit()
    return {"message": "Account deactivated"}
