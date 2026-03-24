"""GoviHub Auth Router — Google OAuth, JWT refresh, logout, me."""

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.schemas import GoogleAuthRequest, TokenResponse, UserBrief
from app.auth.service import GoogleAuthService
from app.config import settings
from app.dependencies import get_current_active_user, get_db
from app.users.models import User

router = APIRouter()

COOKIE_NAME = "govihub_refresh_token"
COOKIE_MAX_AGE = settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    """Set refresh token as httpOnly secure cookie."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=raw_token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=settings.APP_ENV != "development",
        samesite="lax",
        path="/api/v1/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    """Clear refresh token cookie."""
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/api/v1/auth",
    )


@router.post("/google", response_model=TokenResponse)
async def google_auth(
    body: GoogleAuthRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Exchange Google auth code for JWT tokens."""
    google_info = await GoogleAuthService.exchange_code(body.code, body.redirect_uri)
    user, is_new = await GoogleAuthService.find_or_create_user(db, google_info)
    token_response, raw_refresh = await GoogleAuthService.create_tokens(db, user)
    await db.commit()

    _set_refresh_cookie(response, raw_refresh)

    if is_new:
        token_response.registration_required = True

    return token_response


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token using httpOnly cookie."""
    raw_token = request.cookies.get(COOKIE_NAME)
    if not raw_token:
        from app.exceptions import UnauthorizedError
        raise UnauthorizedError(detail="No refresh token")

    token_response = await GoogleAuthService.refresh_access_token(db, raw_token)
    await db.commit()
    return token_response


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Revoke refresh token and clear cookie."""
    raw_token = request.cookies.get(COOKIE_NAME)
    if raw_token:
        await GoogleAuthService.revoke_refresh_token(db, raw_token)
        await db.commit()

    _clear_refresh_cookie(response)
    return {"message": "Logged out"}


@router.get("/me", response_model=UserBrief)
async def get_me(
    current_user: User = Depends(get_current_active_user),
):
    """Get current authenticated user info."""
    return UserBrief.model_validate(current_user)
