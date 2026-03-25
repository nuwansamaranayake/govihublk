"""
Seed beta test users with realistic Sri Lankan farming data.
Run: docker compose -f docker-compose.dev.yml exec govihub-api python scripts/seed_beta_users.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.auth.password import hash_password
from app.database import async_session_factory
from app.users.models import User, UserRole, FarmerProfile, BuyerProfile, SupplierProfile
from sqlalchemy import select


BETA_USERS = [
    {
        "username": "kamal_farmer",
        "password": "govihub123",
        "name": "Kamal Perera",
        "role": UserRole.farmer,
        "district": "Anuradhapura",
        "language": "si",
        "phone": "+94771001001",
        "profile_type": "farmer",
        "profile": {
            "farm_size_acres": 5.0,
            "primary_crops": [],
            "irrigation_type": "rainfed",
            "cooperative": "Anuradhapura Farmer Cooperative",
        },
    },
    {
        "username": "saman_goviya",
        "password": "govihub123",
        "name": "Saman Wickramasinghe",
        "role": UserRole.farmer,
        "district": "Polonnaruwa",
        "language": "si",
        "phone": "+94771001002",
        "profile_type": "farmer",
        "profile": {
            "farm_size_acres": 8.0,
            "primary_crops": [],
            "irrigation_type": "canal",
            "cooperative": "Polonnaruwa Rice Growers",
        },
    },
    {
        "username": "kumari_farm",
        "password": "govihub123",
        "name": "Kumari Jayawardena",
        "role": UserRole.farmer,
        "district": "Anuradhapura",
        "language": "si",
        "phone": "+94771001003",
        "profile_type": "farmer",
        "profile": {
            "farm_size_acres": 3.5,
            "primary_crops": [],
            "irrigation_type": "well",
            "cooperative": "",
        },
    },
    {
        "username": "nimal_buyer",
        "password": "govihub123",
        "name": "Nimal Silva",
        "role": UserRole.buyer,
        "district": "Colombo",
        "language": "en",
        "phone": "+94771002001",
        "profile_type": "buyer",
        "profile": {
            "business_name": "Silva Fresh Produce",
            "business_type": "distributor",
            "preferred_districts": ["Anuradhapura", "Polonnaruwa"],
            "preferred_radius_km": 150,
        },
    },
    {
        "username": "chaminda_buyer",
        "password": "govihub123",
        "name": "Chaminda Fernando",
        "role": UserRole.buyer,
        "district": "Colombo",
        "language": "en",
        "phone": "+94771002002",
        "profile_type": "buyer",
        "profile": {
            "business_name": "Green Valley Supermarkets",
            "business_type": "supermarket",
            "preferred_districts": ["Anuradhapura", "Kurunegala", "Polonnaruwa"],
            "preferred_radius_km": 200,
        },
    },
    {
        "username": "sunil_supplier",
        "password": "govihub123",
        "name": "Sunil Rathnayake",
        "role": UserRole.supplier,
        "district": "Kurunegala",
        "language": "si",
        "phone": "+94771003001",
        "profile_type": "supplier",
        "profile": {
            "business_name": "Rathnayake Agri Supplies",
            "categories": ["fertilizer", "seeds"],
            "coverage_area": ["Kurunegala", "Anuradhapura", "Polonnaruwa"],
            "contact_phone": "+94771003001",
            "contact_whatsapp": "+94771003001",
        },
    },
    {
        "username": "admin",
        "password": "govihub_admin_2026",
        "name": "GoviHub Admin",
        "role": UserRole.admin,
        "district": "Colombo",
        "language": "en",
        "phone": "+94771000001",
        "profile_type": None,
        "profile": None,
    },
]


async def seed():
    print("\n=== GoviHub Beta User Seeder ===\n")
    created = 0
    skipped = 0

    async with async_session_factory() as db:
        for ud in BETA_USERS:
            # Check if username already exists
            result = await db.execute(
                select(User).where(User.username == ud["username"])
            )
            if result.scalar_one_or_none():
                print(f"  SKIP  {ud['username']:20s} ({ud['role'].value}) — already exists")
                skipped += 1
                continue

            # Create user
            user = User(
                username=ud["username"],
                password_hash=hash_password(ud["password"]),
                email=f"{ud['username']}@beta.govihub.lk",
                name=ud["name"],
                role=ud["role"],
                district=ud["district"],
                language=ud["language"],
                phone=ud.get("phone"),
                auth_provider="beta",
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            await db.flush()

            # Create role-specific profile
            if ud["profile_type"] == "farmer" and ud["profile"]:
                db.add(FarmerProfile(user_id=user.id, **ud["profile"]))
            elif ud["profile_type"] == "buyer" and ud["profile"]:
                db.add(BuyerProfile(user_id=user.id, **ud["profile"]))
            elif ud["profile_type"] == "supplier" and ud["profile"]:
                db.add(SupplierProfile(user_id=user.id, **ud["profile"]))

            print(f"  ADD   {ud['username']:20s} ({ud['role'].value})")
            created += 1

        await db.commit()

    print(f"\n--- Summary ---")
    print(f"  Created: {created}")
    print(f"  Skipped: {skipped}")
    print(f"  Total:   {len(BETA_USERS)}")
    print(f"\n  Login URL: /en/auth/beta-login")
    print(f"  All beta passwords: govihub123 (except admin: govihub_admin_2026)")
    print()


if __name__ == "__main__":
    asyncio.run(seed())
