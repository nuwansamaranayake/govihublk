"""GoviHub Beta Auth Schemas — Pydantic V2 models for username/password auth."""

import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.users.phone import validate_e164_phone


# Username validation constants shared with the username-check endpoint.
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]+$")
USERNAME_MIN = 3
USERNAME_MAX = 20


class UsernameError(ValueError):
    """Typed validator failure with a machine-readable code for frontend mapping.

    Pydantic v2 surfaces the live exception instance at ``err["ctx"]["error"]``
    inside ``ValidationError.errors()``. A custom RequestValidationError handler
    in ``app.main`` detects this type and emits a structured
    ``{field, code, message, offending}`` entry instead of the default
    ``{loc, msg, type}`` shape.
    """

    def __init__(self, code: str, message: str, offending: Optional[str] = None) -> None:
        self.code = code
        self.offending = offending
        super().__init__(message)


def validate_username_value(raw: str) -> str:
    """Run the shared username rules. Returns the normalised (lowercase) value.

    Raises ``UsernameError`` with one of:
        REQUIRED | TOO_SHORT | TOO_LONG | HAS_SPACE | INVALID_CHARS
    """
    if raw is None or not raw.strip():
        raise UsernameError("REQUIRED", "Username is required")

    stripped = raw.strip()

    if len(stripped) < USERNAME_MIN:
        raise UsernameError("TOO_SHORT", f"Use at least {USERNAME_MIN} characters")
    if len(stripped) > USERNAME_MAX:
        raise UsernameError("TOO_LONG", f"Maximum {USERNAME_MAX} characters")
    if " " in stripped:
        raise UsernameError("HAS_SPACE", "No spaces allowed. Use underscore (_) instead")
    if not USERNAME_PATTERN.match(stripped):
        bad_chars = sorted(
            {ch for ch in stripped if not re.match(r"[a-zA-Z0-9_]", ch)}
        )
        raise UsernameError(
            "INVALID_CHARS",
            f"Remove these characters: {' '.join(bad_chars)}",
            offending="".join(bad_chars),
        )
    return stripped.lower()


class BetaRegisterRequest(BaseModel):
    """Request body for beta registration with username/password."""

    # Field(max_length=64) is a DoS guardrail, NOT the real username ceiling:
    # it stops Pydantic from doing any work on a 10 MB payload before the
    # validator runs. The real 3–20 range is enforced inside
    # ``validate_username_value`` so that TOO_SHORT / TOO_LONG /
    # HAS_SPACE / INVALID_CHARS arrive as structured UsernameError codes
    # instead of Pydantic's generic string_too_short / string_too_long.
    username: str = Field(..., max_length=64)
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
        return validate_username_value(v)

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
