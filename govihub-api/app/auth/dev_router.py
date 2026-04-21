"""
Development-only authentication bypass.
DO NOT include this router in production (APP_ENV != 'development').
Allows creating test sessions without Google OAuth.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import structlog

from app.config import settings
from app.database import get_db
from app.auth.service import create_access_token
from app.users.models import User, UserRole, FarmerProfile, BuyerProfile, SupplierProfile

logger = structlog.get_logger()
router = APIRouter()

# Pre-defined test users for each role
DEV_USERS = {
    "farmer": {
        "email": "farmer@test.govihub.lk",
        "name": "Kamal Perera",
        "role": UserRole.farmer,
        "district": "Anuradhapura",
        "language": "si",
    },
    "buyer": {
        "email": "buyer@test.govihub.lk",
        "name": "Nimal Silva",
        "role": UserRole.buyer,
        "district": "Colombo",
        "language": "en",
    },
    "supplier": {
        "email": "supplier@test.govihub.lk",
        "name": "Sunil Fernando",
        "role": UserRole.supplier,
        "district": "Kurunegala",
        "language": "si",
    },
    "admin": {
        "email": "admin@test.govihub.lk",
        "name": "Admin User",
        "role": UserRole.admin,
        "district": "Colombo",
        "language": "en",
    },
}


@router.post("/dev/login/{role}")
async def dev_login(role: str, db: AsyncSession = Depends(get_db)):
    """
    Development-only: instantly log in as a test user with the given role.
    Creates the user if it doesn't exist.
    Returns JWT tokens just like the real auth flow.

    Usage: POST /api/v1/auth/dev/login/farmer
           POST /api/v1/auth/dev/login/buyer
           POST /api/v1/auth/dev/login/supplier
           POST /api/v1/auth/dev/login/admin
    """
    if settings.APP_ENV != "development":
        raise HTTPException(403, "Dev auth is disabled in non-development environments")

    if role not in DEV_USERS:
        raise HTTPException(400, f"Invalid role. Choose from: {list(DEV_USERS.keys())}")

    user_data = DEV_USERS[role]

    # Find or create the test user (scoped by email + role)
    result = await db.execute(
        select(User).where(User.email == user_data["email"], User.role == user_data["role"])
    )
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=user_data["email"],
            name=user_data["name"],
            role=user_data["role"],
            district=user_data["district"],
            language=user_data["language"],
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.flush()

        # Create role-specific profile
        if user_data["role"] == UserRole.farmer:
            profile = FarmerProfile(
                user_id=user.id,
                farm_size_acres=5.0,
                primary_crops=[],
                irrigation_type="rainfed",
                cooperative="Anuradhapura Farmer Cooperative",
            )
            db.add(profile)
        elif user_data["role"] == UserRole.buyer:
            profile = BuyerProfile(
                user_id=user.id,
                business_name="Silva Fresh Produce",
                business_type="distributor",
                preferred_districts=["Anuradhapura", "Polonnaruwa"],
                preferred_radius_km=100,
            )
            db.add(profile)
        elif user_data["role"] == UserRole.supplier:
            profile = SupplierProfile(
                user_id=user.id,
                business_name="Fernando Agri Supplies",
                categories=["fertilizer", "seeds", "equipment"],
                coverage_area=["Kurunegala", "Anuradhapura"],
                contact_phone="+94771234567",
                contact_whatsapp="+94771234567",
            )
            db.add(profile)

        await db.commit()
        await db.refresh(user)
        logger.info("dev_auth_user_created", email=user.email, role=role)
    else:
        user.last_login_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info("dev_auth_login", email=user.email, role=role)

    # Create JWT access token directly (skip refresh token for dev)
    access_token = create_access_token(
        user_id=user.id,
        role=user.role.value if user.role else None,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role.value if user.role else None,
            "district": user.district,
            "language": user.language,
            "is_verified": user.is_verified,
        },
        "registration_required": False,
        "_dev_note": "This is a development-only endpoint. It will not work in production.",
    }


@router.get("/dev/users")
async def dev_list_users(db: AsyncSession = Depends(get_db)):
    """List all available dev test users."""
    if settings.APP_ENV != "development":
        raise HTTPException(403, "Dev auth is disabled in non-development environments")

    return {
        "available_roles": list(DEV_USERS.keys()),
        "login_url_pattern": "/api/v1/auth/dev/login/{role}",
        "users": {
            k: {"email": v["email"], "name": v["name"], "role": v["role"].value, "district": v["district"]}
            for k, v in DEV_USERS.items()
        },
    }
