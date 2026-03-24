"""GoviHub User Service — Registration, profile management, location."""

from typing import Optional
from uuid import UUID

import structlog
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.notifications.models import NotificationPreference
from app.users.models import BuyerProfile, FarmerProfile, SupplierProfile, User, UserRole

logger = structlog.get_logger()


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def complete_registration(self, user_id: UUID, data: dict) -> User:
        """Assign role and create profile for new user."""
        user = await self._get_user(user_id)

        if user.role is not None:
            raise ValidationError(detail="User already has a role assigned")

        role = UserRole(data["role"])
        user.role = role
        user.name = data["name"]
        user.is_active = True

        if data.get("phone"):
            user.phone = data["phone"]
        if data.get("language"):
            user.language = data["language"]
        if data.get("district"):
            user.district = data["district"]
        if data.get("gn_division"):
            user.gn_division = data["gn_division"]
        if data.get("ds_division"):
            user.ds_division = data["ds_division"]
        if data.get("province"):
            user.province = data["province"]

        # Create profile
        if role == UserRole.farmer:
            self.db.add(FarmerProfile(user_id=user.id))
        elif role == UserRole.buyer:
            self.db.add(BuyerProfile(user_id=user.id))
        elif role == UserRole.supplier:
            self.db.add(SupplierProfile(user_id=user.id))

        # Create notification preferences
        self.db.add(NotificationPreference(user_id=user.id))

        await self.db.flush()
        logger.info("registration_complete", user_id=str(user.id), role=role.value)
        return user

    async def get_user(self, user_id: UUID) -> User:
        """Get user with eager-loaded profiles."""
        result = await self.db.execute(
            select(User)
            .where(User.id == user_id)
            .options(
                selectinload(User.farmer_profile),
                selectinload(User.buyer_profile),
                selectinload(User.supplier_profile),
            )
        )
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundError(detail="User not found")
        return user

    async def get_user_public(self, user_id: UUID) -> User:
        """Get public user view (no sensitive data)."""
        return await self.get_user(user_id)

    async def update_user(self, user_id: UUID, data: dict) -> User:
        """Update basic user fields."""
        user = await self._get_user(user_id)
        for key, value in data.items():
            if value is not None and hasattr(user, key):
                setattr(user, key, value)
        await self.db.flush()
        return user

    async def update_location(self, user_id: UUID, lat: float, lng: float) -> User:
        """Update user's PostGIS location."""
        user = await self._get_user(user_id)
        await self.db.execute(
            text(
                "UPDATE users SET location = ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) "
                "WHERE id = :uid"
            ).bindparams(lng=lng, lat=lat, uid=user_id)
        )
        await self.db.flush()
        return user

    async def update_farmer_profile(self, user_id: UUID, data: dict) -> FarmerProfile:
        """Update farmer profile."""
        user = await self._get_user(user_id)
        if user.role != UserRole.farmer:
            raise ForbiddenError(detail="User is not a farmer")

        result = await self.db.execute(
            select(FarmerProfile).where(FarmerProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            profile = FarmerProfile(user_id=user_id)
            self.db.add(profile)

        for key, value in data.items():
            if value is not None and hasattr(profile, key):
                setattr(profile, key, value)
        await self.db.flush()
        return profile

    async def update_buyer_profile(self, user_id: UUID, data: dict) -> BuyerProfile:
        """Update buyer profile."""
        user = await self._get_user(user_id)
        if user.role != UserRole.buyer:
            raise ForbiddenError(detail="User is not a buyer")

        result = await self.db.execute(
            select(BuyerProfile).where(BuyerProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            profile = BuyerProfile(user_id=user_id)
            self.db.add(profile)

        for key, value in data.items():
            if value is not None and hasattr(profile, key):
                setattr(profile, key, value)
        await self.db.flush()
        return profile

    async def update_supplier_profile(self, user_id: UUID, data: dict) -> SupplierProfile:
        """Update supplier profile."""
        user = await self._get_user(user_id)
        if user.role != UserRole.supplier:
            raise ForbiddenError(detail="User is not a supplier")

        result = await self.db.execute(
            select(SupplierProfile).where(SupplierProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            profile = SupplierProfile(user_id=user_id)
            self.db.add(profile)

        for key, value in data.items():
            if value is not None and hasattr(profile, key):
                setattr(profile, key, value)
        await self.db.flush()
        return profile

    async def deactivate_user(self, user_id: UUID) -> None:
        """Soft delete user."""
        user = await self._get_user(user_id)
        user.is_active = False
        await self.db.flush()
        logger.info("user_deactivated", user_id=str(user_id))

    async def _get_user(self, user_id: UUID) -> User:
        """Internal: get user or raise 404."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundError(detail="User not found")
        return user
