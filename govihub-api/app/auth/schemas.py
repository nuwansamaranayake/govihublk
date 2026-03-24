"""GoviHub Auth Schemas — Pydantic v2 models for authentication."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class GoogleAuthRequest(BaseModel):
    """Request body for Google OAuth code exchange."""
    code: str
    redirect_uri: str


class UserBrief(BaseModel):
    """Brief user info returned with tokens."""
    id: UUID
    name: str
    email: str
    role: Optional[str] = None
    avatar_url: Optional[str] = None
    language: str = "si"

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserBrief
    registration_required: bool = False


class RefreshTokenRequest(BaseModel):
    """Refresh token request — token comes from httpOnly cookie."""
    pass


class TokenPayload(BaseModel):
    """JWT token payload."""
    sub: str  # user_id as string
    role: Optional[str] = None
    exp: int
    iat: int
    jti: str  # unique token ID
