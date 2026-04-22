"""GoviHub Beta Auth Router — Username/password registration, login, and password change."""

import re
import uuid
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.beta_schemas import (
    BetaChangePasswordRequest,
    BetaLoginRequest,
    BetaRegisterRequest,
    USERNAME_MAX,
    USERNAME_MIN,
    USERNAME_PATTERN,
)
from app.auth.password import hash_password, verify_password
from app.auth.schemas import TokenResponse, UserBrief
from app.auth.service import create_access_token, decode_access_token
from app.config import settings
from app.database import get_db
from app.dependencies import get_redis
from app.users.models import BuyerProfile, FarmerProfile, SupplierProfile, User, UserRole

logger = structlog.get_logger()

router = APIRouter(tags=["beta-auth"])


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

    # Check email uniqueness scoped to role (same email allowed across different roles)
    target_email = body.email or f"{body.username.lower()}@beta.govihub.lk"
    email_check = await db.execute(
        select(User).where(User.email == target_email, User.role == UserRole(body.role))
    )
    if email_check.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"You already have a {body.role} account with this email")

    # Cap at 3 accounts per email (one per role: farmer, buyer, supplier)
    email_count = await db.execute(
        select(func.count()).select_from(User).where(User.email == target_email)
    )
    if email_count.scalar() >= 3:
        raise HTTPException(status_code=409, detail="Maximum 3 accounts per email (one per role)")

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


# ── Username availability / format check ──────────────────────────────────────

_USERNAME_CHECK_LIMIT = 30  # requests per IP per minute
_USERNAME_CHECK_WINDOW = 60  # seconds


def _client_ip(request: Request) -> str:
    """Best-effort real-client IP behind Traefik.

    Traefik overwrites X-Real-IP with the direct client IP on every hop,
    so it's the most trustworthy single-source header in our setup.
    Falls back to the last token of X-Forwarded-For (what our own edge
    proxy observed — not client-spoofable because Traefik appends) and
    finally the socket peer.
    """
    xri = request.headers.get("x-real-ip")
    if xri:
        return xri.strip()
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.rsplit(",", 1)[-1].strip()
    return request.client.host if request.client else "unknown"


async def _check_rate_limit(request: Request, redis) -> None:
    """Inline Redis counter: 30 username-check requests per IP per minute."""
    ip = _client_ip(request)
    key = f"rl:username_check:{ip}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, _USERNAME_CHECK_WINDOW)
    if count > _USERNAME_CHECK_LIMIT:
        raise HTTPException(status_code=429, detail="Too many requests")


async def _generate_username_suggestions(db: AsyncSession, base: str) -> list[str]:
    """Return up to 3 unused variants of ``base`` by suffixing digits/underscores."""
    candidates = [f"{base}_{n}" for n in (1, 86, 2026)] + [f"{base}{n}" for n in (1, 2)]
    # Enforce the upper bound on candidates too.
    candidates = [c[:USERNAME_MAX] for c in candidates]
    result = await db.execute(select(User.username).where(User.username.in_(candidates)))
    taken = {row[0] for row in result.all() if row[0]}
    free = [c for c in candidates if c not in taken]
    return free[:3]


@router.get("/beta/username-check")
async def beta_username_check(
    request: Request,
    u: str = Query(..., min_length=1, max_length=64),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """Real-time username availability + validity check.

    Returns 200 with a structured body. The frontend reads ``valid`` +
    ``available`` + ``code``. Never returns 4xx for validation failures —
    that's the point of a "check" endpoint — but DOES return 429 when the
    per-IP rate limit fires. See STEP 1.3 of CC_USERNAME_MANDATORY.md.
    """
    _check_beta_env()
    await _check_rate_limit(request, redis)

    raw = u.strip()

    # Validity gates (mirror BetaRegisterRequest.validate_username rules).
    if not raw:
        return {"valid": False, "code": "REQUIRED", "available": None, "suggestions": []}
    if len(raw) < USERNAME_MIN:
        return {"valid": False, "code": "TOO_SHORT", "available": None, "suggestions": []}
    if len(raw) > USERNAME_MAX:
        return {"valid": False, "code": "TOO_LONG", "available": None, "suggestions": []}
    if " " in raw:
        return {"valid": False, "code": "HAS_SPACE", "available": None, "suggestions": []}
    if not USERNAME_PATTERN.match(raw):
        bad_chars = sorted({ch for ch in raw if not re.match(r"[a-zA-Z0-9_]", ch)})
        return {
            "valid": False,
            "code": "INVALID_CHARS",
            "available": None,
            "suggestions": [],
            "offending": "".join(bad_chars),
        }

    # Availability — case-insensitive lookup matches register/login behaviour.
    normalized = raw.lower()
    result = await db.execute(
        select(User.id).where(func.lower(User.username) == normalized)
    )
    taken = result.scalar_one_or_none() is not None

    suggestions: list[str] = []
    if taken:
        suggestions = await _generate_username_suggestions(db, normalized)

    return {
        "valid": True,
        "code": "OK" if not taken else "TAKEN",
        "available": not taken,
        "suggestions": suggestions,
    }
