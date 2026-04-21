"""GoviHub Dependencies — Auth, DB, Redis dependency injection."""

from typing import Optional

import redis.asyncio as aioredis
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db as _get_db
from app.exceptions import ForbiddenError, ProfileIncompleteError, UnauthorizedError

# Re-export for consistent imports
get_db = _get_db

# Security scheme
security = HTTPBearer(auto_error=False)

# Redis singleton
_redis_pool: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    """Get Redis connection (singleton pool)."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_pool


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """Extract and validate JWT, return User object."""
    if not credentials:
        raise UnauthorizedError(detail="Missing authorization header")

    from app.auth.service import decode_access_token
    from app.users.models import User

    payload = decode_access_token(credentials.credentials)

    result = await db.execute(select(User).where(User.id == payload.sub))
    user = result.scalar_one_or_none()

    if not user:
        raise UnauthorizedError(detail="User not found")

    return user


async def get_current_active_user(
    user=Depends(get_current_user),
):
    """Ensure user is active."""
    if not user.is_active:
        raise ForbiddenError(detail="Inactive user account")
    return user


async def require_complete_profile(user=Depends(get_current_active_user)):
    """Non-admin users with a role must have a phone number.

    Returns 428 PROFILE_INCOMPLETE so the frontend can redirect to /complete-profile.
    Admins are exempt — their phone field stays nullable.
    Users with role=None are passed through; they will be blocked separately by
    require_registration_complete or require_role on routes that need a role.
    """
    from app.users.models import UserRole

    if user.role is None or user.role == UserRole.admin:
        return user
    if not user.phone or not user.phone.strip():
        raise ProfileIncompleteError(required_field="phone")
    return user


def require_role(*allowed_roles: str):
    """Dependency factory: require user has one of the allowed roles AND a complete profile.

    Non-admin users must have a phone set (profile gate); admins are exempt.
    """

    async def _check_role(user=Depends(require_complete_profile)):
        if user.role is None:
            raise ForbiddenError(
                detail="Registration incomplete",
                details={"error_code": "REGISTRATION_INCOMPLETE"},
            )
        if user.role.value not in allowed_roles:
            raise ForbiddenError(
                detail=f"Role '{user.role.value}' not allowed. Required: {allowed_roles}"
            )
        return user

    return _check_role


def require_registration_complete():
    """Dependency: require user has completed registration (has a role)."""

    async def _check(user=Depends(get_current_active_user)):
        if user.role is None:
            raise ForbiddenError(
                detail="Registration incomplete",
                details={"error_code": "REGISTRATION_INCOMPLETE"},
            )
        return user

    return _check
