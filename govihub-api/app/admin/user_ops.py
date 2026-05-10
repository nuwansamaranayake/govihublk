"""Admin user operations.

This module hosts admin-only user actions that aren't covered by the existing
AdminService methods (list/get/update/delete and admin-supplied reset-password).
The new piece here is the auto-generated temporary password flow used by the
admin panel "reset password" button — the admin clicks once, the panel shows
the temp password, the user is forced to change it on next login.
"""

from __future__ import annotations

import secrets
import string
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.password import hash_password
from app.exceptions import NotFoundError
from app.users.models import User

logger = structlog.get_logger()


# Removed visually ambiguous characters: 0/O, 1/l/I.
_TEMP_PW_ALPHABET = (
    string.ascii_letters.replace("l", "").replace("O", "").replace("I", "")
    + "23456789"
)


def generate_temp_password(length: int = 12) -> str:
    """Generate a readable temporary password using a CSPRNG.

    Length defaults to 12 to satisfy the existing min_length=8 password rule
    from app.admin.schemas.ResetPasswordRequest with comfortable margin.
    """
    if length < 8:
        raise ValueError("Temporary password length must be at least 8")
    return "".join(secrets.choice(_TEMP_PW_ALPHABET) for _ in range(length))


async def reset_user_password_temp(
    db: AsyncSession, user_id: UUID
) -> tuple[User, str]:
    """Generate a temp password, hash and store it, return (user, plaintext).

    The caller must show the plaintext to the admin once and never persist it.
    The admin router does NOT log the plaintext per CRITICAL RULE #8.
    """
    user = await db.get(User, user_id)
    if user is None:
        raise NotFoundError(detail=f"User {user_id} not found")

    temp_pw = generate_temp_password()
    user.password_hash = hash_password(temp_pw)
    await db.flush()

    # Note: deliberately NOT logging the temp password. Only fact-of-reset.
    logger.info(
        "admin_reset_password_temp",
        user_id=str(user_id),
        username=user.username,
    )
    return user, temp_pw
