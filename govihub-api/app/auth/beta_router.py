"""GoviHub Beta Auth Router — Username/password registration, login, and password change."""

import uuid
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.beta_schemas import BetaChangePasswordRequest, BetaLoginRequest, BetaRegisterRequest
from app.auth.password import hash_password, verify_password
from app.auth.schemas import TokenResponse, UserBrief
from app.auth.service import create_access_token, decode_access_token
from app.config import settings
from app.database import get_db
from app.users.models import BuyerProfile, FarmerProfile, SupplierProfile, User, UserRole

logger = structlog.get_logger()

router = APIRouter(prefix="/auth", tags=["beta-auth"])


def _check_beta_env() -> None:
    """Guard: only allow beta endpoints in beta/development environments."""
    if settings.APP_ENV not in ("beta", "development"):
        raise HTTPException(status_code=403, detail="Beta auth is only available in beta/development environments")


async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Decode JWT from Authorization header and return the current user."""
    token = authorization.replace("Bearer ", "")
    payload = decode_access_token(token)
    result = await db.execute(select(User).where(User.id == uuid.UUID(payload.sub)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")
    return user


@router.post("/beta/register", response_model=TokenResponse)
async def beta_register(body: BetaRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user with username and password (beta/dev only)."""
    _check_beta_env()

    # Check username uniqueness (case-insensitive)
    existing = await db.execute(
        select(User).where(func.lower(User.username) == body.username.lower())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already taken")

    # Check email uniqueness if provided
    if body.email:
        email_check = await db.execute(select(User).where(User.email == body.email))
        if email_check.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already registered")

    # Create user
    user = User(
        username=body.username.lower(),
        password_hash=hash_password(body.password),
        auth_provider="beta",
        name=body.name,
        email=body.email or f"{body.username.lower()}@beta.govihub.lk",
        role=UserRole(body.role),
        district=body.district,
        language=body.language,
        phone=body.phone,
        is_active=True,
        is_verified=True,
        last_login_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()

    # Create role-specific profile
    if body.role == "farmer":
        profile = FarmerProfile(user_id=user.id)
        db.add(profile)
    elif body.role == "buyer":
        profile = BuyerProfile(user_id=user.id)
        db.add(profile)
    elif body.role == "supplier":
        profile = SupplierProfile(user_id=user.id)
        db.add(profile)

    await db.flush()

    # Generate access token
    access_token = create_access_token(user_id=user.id, role=user.role.value)

    logger.info("beta_user_registered", user_id=str(user.id), username=user.username, role=body.role)

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserBrief.model_validate(user),
        registration_required=False,
    )


@router.post("/beta/login", response_model=TokenResponse)
async def beta_login(body: BetaLoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with username and password (beta/dev only)."""
    _check_beta_env()

    # Look up user by username (case-insensitive)
    result = await db.execute(
        select(User).where(func.lower(User.username) == body.username.lower())
    )
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    await db.flush()

    access_token = create_access_token(
        user_id=user.id,
        role=user.role.value if user.role else None,
    )

    logger.info("beta_user_login", user_id=str(user.id), username=user.username)

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserBrief.model_validate(user),
        registration_required=user.role is None,
    )


@router.post("/beta/change-password")
async def beta_change_password(
    body: BetaChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change password for the current authenticated user (beta/dev only)."""
    _check_beta_env()

    if not current_user.password_hash:
        raise HTTPException(status_code=400, detail="User does not have a password set")

    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    current_user.password_hash = hash_password(body.new_password)
    await db.flush()

    logger.info("beta_password_changed", user_id=str(current_user.id))

    return {"message": "Password changed successfully"}
