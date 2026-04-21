"""GoviHub Beta Auth Schemas — Pydantic V2 models for username/password auth."""

import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.users.phone import validate_e164_phone


class BetaRegisterRequest(BaseModel):
    """Request body for beta registration with username/password."""

    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)
    role: str = Field(..., pattern="^(farmer|buyer|supplier)$")
    district: str = Field(..., min_length=1, max_length=100)
    language: str = Field(default="si", max_length=5)
    phone: str = Field(..., min_length=8, max_length=16, description="Phone number in E.164 format (required)")
    email: Optional[str] = Field(default=None, max_length=255)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError("Username must contain only letters, numbers, and underscores")
        return v.lower()

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return validate_e164_phone(v)


class BetaLoginRequest(BaseModel):
    """Request body for beta login."""

    username: str
    password: str


class BetaChangePasswordRequest(BaseModel):
    """Request body for changing password."""

    current_password: str
    new_password: str = Field(..., min_length=6, max_length=128)
