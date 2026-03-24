"""GoviHub Admin User Creator — Create an admin user from email."""

import asyncio
import sys
from pathlib import Path

import structlog

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import async_session_factory
from app.users.models import User, UserRole
from app.auth.models import GoogleAccount

logger = structlog.get_logger()


async def create_admin(email: str, name: str = "Admin"):
    """Create an admin user with a linked Google account."""
    async with async_session_factory() as session:
        from sqlalchemy import select

        # Check if user exists
        result = await session.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()

        if existing:
            if existing.role == UserRole.admin:
                logger.info("admin_exists", email=email)
                return
            existing.role = UserRole.admin
            existing.is_verified = True
            await session.commit()
            logger.info("user_promoted_to_admin", email=email)
            return

        # Create new admin user
        user = User(
            email=email,
            name=name,
            role=UserRole.admin,
            is_active=True,
            is_verified=True,
            language="en",
        )
        session.add(user)
        await session.flush()

        # Link Google account placeholder
        google_account = GoogleAccount(
            user_id=user.id,
            google_id=f"admin_{email}",
            email=email,
            name=name,
        )
        session.add(google_account)
        await session.commit()

        logger.info("admin_created", email=email, user_id=str(user.id))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m scripts.create_admin <email> [name]")
        sys.exit(1)

    email = sys.argv[1]
    name = sys.argv[2] if len(sys.argv) > 2 else "Admin"
    asyncio.run(create_admin(email, name))
