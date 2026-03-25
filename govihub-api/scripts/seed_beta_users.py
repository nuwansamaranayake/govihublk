"""Seed beta test users for GoviHub beta environment.

Usage:
    python scripts/seed_beta_users.py

Idempotent — skips users that already exist (matched by username).
"""

import asyncio
import sys
from pathlib import Path

# Ensure app is importable when running from scripts/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.auth.password import hash_password
from app.database import async_session_factory
from app.users.models import User, UserRole, FarmerProfile, BuyerProfile, SupplierProfile
from sqlalchemy import select


BETA_USERS = [
    # ── Farmers ──
    {
        "username": "kamal_farmer",
        "password": "govihub123",
        "name": "Kamal Perera",
        "role": UserRole.farmer,
        "district": "Anuradhapura",
        "language": "si",
        "phone": "+94771001001",
        "profile": {
            "type": "farmer",
            "farm_size_acres": 5.0,
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
        "profile": {
            "type": "farmer",
            "farm_size_acres": 8.0,
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
        "profile": {
            "type": "farmer",
            "farm_size_acres": 3.5,
            "irrigation_type": "well",
            "cooperative": None,
        },
    },
    # ── Buyers ──
    {
        "username": "nimal_buyer",
        "password": "govihub123",
        "name": "Nimal Silva",
        "role": UserRole.buyer,
        "district": "Colombo",
        "language": "en",
        "phone": "+94771002001",
        "profile": {
            "type": "buyer",
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
        "profile": {
            "type": "buyer",
            "business_name": "Green Valley Supermarkets",
            "business_type": "supermarket",
            "preferred_districts": ["Anuradhapura", "Kurunegala", "Polonnaruwa"],
            "preferred_radius_km": 200,
        },
    },
    # ── Supplier ──
    {
        "username": "sunil_supplier",
        "password": "govihub123",
        "name": "Sunil Rathnayake",
        "role": UserRole.supplier,
        "district": "Kurunegala",
        "language": "si",
        "phone": "+94771003001",
        "profile": {
            "type": "supplier",
            "business_name": "Rathnayake Agri Supplies",
            "categories": ["fertilizer", "seeds"],
            "coverage_area": ["Kurunegala", "Anuradhapura", "Polonnaruwa"],
            "contact_whatsapp": "+94771003001",
        },
    },
    # ── Admin ──
    {
        "username": "admin",
        "password": "govihub_admin_2026",
        "name": "GoviHub Admin",
        "role": UserRole.admin,
        "district": "Colombo",
        "language": "en",
        "phone": "+94771000001",
        "profile": None,
    },
]


async def seed():
    print("\n" + "=" * 48)
    print("  GoviHub Beta -- Seeding Test Users")
    print("=" * 48 + "\n")

    created = []
    skipped = []

    async with async_session_factory() as db:
        for user_data in BETA_USERS:
            username = user_data["username"]

            # Check if user already exists
            result = await db.execute(
                select(User).where(User.username == username)
            )
            existing = result.scalar_one_or_none()
            if existing:
                print(f"  SKIP  {username:<20} (already exists)")
                skipped.append(username)
                continue

            # Create user
            user = User(
                username=username,
                password_hash=hash_password(user_data["password"]),
                auth_provider="beta",
                email=f"{username}@beta.govihub.lk",
                name=user_data["name"],
                role=user_data["role"],
                district=user_data["district"],
                language=user_data["language"],
                phone=user_data["phone"],
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            await db.flush()

            # Create role-specific profile
            profile_data = user_data.get("profile")
            if profile_data:
                ptype = profile_data["type"]
                if ptype == "farmer":
                    profile = FarmerProfile(
                        user_id=user.id,
                        farm_size_acres=profile_data.get("farm_size_acres"),
                        irrigation_type=profile_data.get("irrigation_type"),
                        cooperative=profile_data.get("cooperative"),
                    )
                    db.add(profile)
                elif ptype == "buyer":
                    profile = BuyerProfile(
                        user_id=user.id,
                        business_name=profile_data.get("business_name"),
                        business_type=profile_data.get("business_type"),
                        preferred_districts=profile_data.get("preferred_districts"),
                        preferred_radius_km=profile_data.get("preferred_radius_km", 50),
                    )
                    db.add(profile)
                elif ptype == "supplier":
                    profile = SupplierProfile(
                        user_id=user.id,
                        business_name=profile_data.get("business_name"),
                        categories=profile_data.get("categories"),
                        coverage_area=profile_data.get("coverage_area"),
                        contact_whatsapp=profile_data.get("contact_whatsapp"),
                    )
                    db.add(profile)

            print(f"  ADD   {username:<20} ({user_data['role'].value})")
            created.append(username)

        await db.commit()

    # Summary
    print("\n" + "-" * 48)
    print("  Summary")
    print("-" * 48)
    print(f"  Created : {len(created)}")
    print(f"  Skipped : {len(skipped)}")
    print("-" * 48)
    print(f"  {'Username':<22} {'Role':<10} {'Status'}")
    print("-" * 48)
    for user_data in BETA_USERS:
        status = "NEW" if user_data["username"] in created else "---"
        print(f"  {user_data['username']:<22} {user_data['role'].value:<10} {status}")
    print("-" * 48 + "\n")


if __name__ == "__main__":
    asyncio.run(seed())
