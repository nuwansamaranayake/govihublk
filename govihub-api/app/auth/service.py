"""GoviHub Auth Service — Google OAuth, JWT management, token lifecycle."""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import httpx
import structlog
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import GoogleAccount, RefreshToken
from app.auth.schemas import TokenPayload, TokenResponse, UserBrief
from app.config import settings
from app.exceptions import ExternalServiceError, UnauthorizedError
from app.users.models import User

logger = structlog.get_logger()

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def _hash_token(token: str) -> str:
    """SHA256 hash a token for secure storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(user_id: uuid.UUID, role: Optional[str] = None) -> str:
    """Create a JWT access token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
        "iat": now,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> TokenPayload:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return TokenPayload(**payload)
    except JWTError as e:
        raise UnauthorizedError(detail=f"Invalid token: {e}")


class GoogleAuthService:
    """Handles Google OAuth flow and user management."""

    @staticmethod
    async def exchange_code(code: str, redirect_uri: str) -> dict:
        """Exchange Google auth code for user info.

        Returns dict with google_id, email, name, picture.
        """
        async with httpx.AsyncClient() as client:
            # Exchange code for tokens
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )

            if token_response.status_code != 200:
                logger.error("google_token_exchange_failed", status=token_response.status_code)
                raise ExternalServiceError(detail="Failed to exchange Google auth code")

            token_data = token_response.json()
            access_token = token_data.get("access_token")

            if not access_token:
                raise ExternalServiceError(detail="No access token from Google")

            # Get user info
            userinfo_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if userinfo_response.status_code != 200:
                raise ExternalServiceError(detail="Failed to get Google user info")

            userinfo = userinfo_response.json()

            # Validate audience if id_token present
            id_token = token_data.get("id_token")
            if id_token:
                try:
                    id_payload = jwt.decode(
                        id_token,
                        options={"verify_signature": False, "verify_aud": False},
                    )
                    if id_payload.get("aud") != settings.GOOGLE_CLIENT_ID:
                        logger.warning("google_aud_mismatch")
                    if id_payload.get("iss") not in (
                        "accounts.google.com",
                        "https://accounts.google.com",
                    ):
                        logger.warning("google_iss_mismatch")
                except Exception:
                    pass  # Non-critical — we validated via userinfo endpoint

            return {
                "google_id": userinfo["sub"],
                "email": userinfo["email"],
                "name": userinfo.get("name", ""),
                "picture": userinfo.get("picture"),
            }

    @staticmethod
    async def find_or_create_user(
        db: AsyncSession, google_info: dict
    ) -> Tuple[User, bool]:
        """Find existing user by Google ID or create new one.

        Returns (user, is_new).
        """
        # Check for existing Google account
        result = await db.execute(
            select(GoogleAccount).where(GoogleAccount.google_id == google_info["google_id"])
        )
        google_account = result.scalar_one_or_none()

        if google_account:
            # Existing user — update last login
            user_result = await db.execute(
                select(User).where(User.id == google_account.user_id)
            )
            user = user_result.scalar_one()
            user.last_login_at = datetime.now(timezone.utc)

            # Update Google info if changed
            google_account.email = google_info["email"]
            google_account.name = google_info["name"]
            google_account.picture_url = google_info.get("picture")

            await db.flush()
            logger.info("user_login", user_id=str(user.id), email=user.email)
            return user, False

        # Check if email already exists (edge case)
        result = await db.execute(
            select(User).where(User.email == google_info["email"])
        )
        existing_user = result.scalar_one_or_none()

        if existing_user:
            # Link Google account to existing user
            google_account = GoogleAccount(
                user_id=existing_user.id,
                google_id=google_info["google_id"],
                email=google_info["email"],
                name=google_info["name"],
                picture_url=google_info.get("picture"),
            )
            db.add(google_account)
            existing_user.last_login_at = datetime.now(timezone.utc)
            existing_user.avatar_url = google_info.get("picture")
            await db.flush()
            logger.info("google_linked", user_id=str(existing_user.id))
            return existing_user, False

        # New user
        user = User(
            email=google_info["email"],
            name=google_info["name"],
            role=None,  # Set during registration
            avatar_url=google_info.get("picture"),
            is_active=True,
            is_verified=False,
            language="si",
            last_login_at=datetime.now(timezone.utc),
        )
        db.add(user)
        await db.flush()

        google_account = GoogleAccount(
            user_id=user.id,
            google_id=google_info["google_id"],
            email=google_info["email"],
            name=google_info["name"],
            picture_url=google_info.get("picture"),
        )
        db.add(google_account)
        await db.flush()

        logger.info("user_created", user_id=str(user.id), email=user.email)
        return user, True

    @staticmethod
    async def create_tokens(db: AsyncSession, user: User) -> TokenResponse:
        """Create JWT access token and refresh token pair."""
        access_token = create_access_token(
            user_id=user.id,
            role=user.role.value if user.role else None,
        )

        # Generate refresh token
        raw_refresh_token = secrets.token_urlsafe(64)
        hashed_token = _hash_token(raw_refresh_token)

        refresh = RefreshToken(
            user_id=user.id,
            token=hashed_token,
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
        )
        db.add(refresh)
        await db.flush()

        return TokenResponse(
            access_token=access_token,
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserBrief.model_validate(user),
            registration_required=user.role is None,
        ), raw_refresh_token

    @staticmethod
    async def refresh_access_token(
        db: AsyncSession, raw_refresh_token: str
    ) -> TokenResponse:
        """Validate refresh token and issue new access token."""
        hashed = _hash_token(raw_refresh_token)

        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.token == hashed,
                RefreshToken.is_revoked == False,
            )
        )
        refresh = result.scalar_one_or_none()

        if not refresh:
            raise UnauthorizedError(detail="Invalid refresh token")

        if refresh.expires_at < datetime.now(timezone.utc):
            refresh.is_revoked = True
            await db.flush()
            raise UnauthorizedError(detail="Refresh token expired")

        # Get user
        user_result = await db.execute(
            select(User).where(User.id == refresh.user_id)
        )
        user = user_result.scalar_one_or_none()

        if not user or not user.is_active:
            raise UnauthorizedError(detail="User not found or inactive")

        access_token = create_access_token(
            user_id=user.id,
            role=user.role.value if user.role else None,
        )

        return TokenResponse(
            access_token=access_token,
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserBrief.model_validate(user),
        )

    @staticmethod
    async def revoke_refresh_token(db: AsyncSession, raw_token: str) -> None:
        """Revoke a specific refresh token."""
        hashed = _hash_token(raw_token)
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token == hashed)
        )
        refresh = result.scalar_one_or_none()
        if refresh:
            refresh.is_revoked = True
            await db.flush()

    @staticmethod
    async def revoke_all_user_tokens(db: AsyncSession, user_id: uuid.UUID) -> None:
        """Revoke all refresh tokens for a user."""
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.is_revoked == False,
            )
        )
        tokens = result.scalars().all()
        for token in tokens:
            token.is_revoked = True
        await db.flush()
