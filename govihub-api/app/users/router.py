"""GoviHub Users Router — Registration, profile CRUD, preferences."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_active_user, get_current_user, get_db, require_role
from app.users.models import User
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

router = APIRouter()


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
