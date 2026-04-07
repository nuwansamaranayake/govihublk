"""GoviHub Spices Admin Creator — Create admin with username/password auth."""

import asyncio
import sys
from pathlib import Path

import structlog

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.auth.password import hash_password
from app.database import async_session_factory
from app.users.models import User, UserRole

logger = structlog.get_logger()


async def create_admin(username: str, password: str, name: str = "Admin"):
    """Create an admin user with username/password authentication."""
    async with async_session_factory() as session:
        from sqlalchemy import func, select

        # Check if user exists
        result = await session.execute(
            select(User).where(func.lower(User.username) == username.lower())
        )
        existing = result.scalar_one_or_none()

        if existing:
            if existing.role == UserRole.admin:
                logger.info("admin_exists", username=username)
                print(f"Admin user '{username}' already exists.")
                return
            existing.role = UserRole.admin
            existing.is_verified = True
            existing.password_hash = hash_password(password)
            await session.commit()
            logger.info("user_promoted_to_admin", username=username)
            print(f"User '{username}' promoted to admin.")
            return

        # Create new admin user
        user = User(
            username=username.lower(),
            password_hash=hash_password(password),
            auth_provider="beta",
            name=name,
            email=f"{username.lower()}@spices.govihublk.com",
            role=UserRole.admin,
            is_active=True,
            is_verified=True,
            language="si",
        )
        session.add(user)
        await session.commit()

        logger.info("admin_created", username=username, user_id=str(user.id))
        print(f"Admin user '{username}' created successfully.")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python scripts/create_spices_admin.py <username> <password> [name]")
        sys.exit(1)

    username = sys.argv[1]
    password = sys.argv[2]
    name = sys.argv[3] if len(sys.argv) > 3 else "Admin"
    asyncio.run(create_admin(username, password, name))
