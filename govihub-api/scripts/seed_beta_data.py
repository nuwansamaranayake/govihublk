"""
Seed realistic beta marketplace data — harvest listings, demands, supplies.
Run: docker compose -f docker-compose.dev.yml exec govihub-api python scripts/seed_beta_data.py
"""

import asyncio
import sys
import os
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import async_session_factory
from app.users.models import User
from sqlalchemy import select, text


# Coordinates
COORDS = {
    "Anuradhapura": (8.3114, 80.4037),
    "Polonnaruwa": (7.9403, 81.0188),
    "Colombo": (6.9271, 79.8612),
    "Kurunegala": (7.4863, 80.3647),
}

TODAY = date.today()


async def seed():
    print("\n=== GoviHub Beta Data Seeder ===\n")

    async with async_session_factory() as db:
        # Look up beta users
        users = {}
        for username in ["kamal_farmer", "saman_goviya", "kumari_farm",
                         "nimal_buyer", "chaminda_buyer", "sunil_supplier"]:
            result = await db.execute(
                select(User).where(User.username == username)
            )
            user = result.scalar_one_or_none()
            if user:
                users[username] = user
            else:
                print(f"  WARN: {username} not found — run seed_beta_users.py first")

        if not users:
            print("  ERROR: No beta users found. Run seed_beta_users.py first.")
            return

        # Look up crop IDs from taxonomy
        crop_map = {}
        result = await db.execute(text(
            "SELECT id, name_en FROM crop_taxonomy WHERE name_en IS NOT NULL"
        ))
        for row in result.fetchall():
            crop_map[row[1].lower()] = row[0]

        print(f"  Found {len(crop_map)} crops in taxonomy")

        # Helper to find crop ID
        def find_crop(name):
            name_l = name.lower()
            for key, cid in crop_map.items():
                if name_l in key or key in name_l:
                    return cid
            return None

        harvest_count = 0
        demand_count = 0
        supply_count = 0

        # ---- HARVEST LISTINGS ----
        print("\n  Harvest Listings:")

        harvests = [
            # (username, crop_search, qty_kg, price_per_kg, available_from, available_to, status)
            ("kamal_farmer", "samba", 500, 220, TODAY + timedelta(days=14), TODAY + timedelta(days=28), "ready"),
            ("kamal_farmer", "onion", 200, 350, TODAY, TODAY + timedelta(days=7), "ready"),
            ("kamal_farmer", "chili", 100, 450, TODAY, TODAY + timedelta(days=5), "ready"),
            ("saman_goviya", "nadu", 1000, 200, TODAY + timedelta(days=7), TODAY + timedelta(days=21), "ready"),
            ("saman_goviya", "tomato", 300, 280, TODAY, TODAY + timedelta(days=5), "ready"),
            ("kumari_farm", "long bean", 150, 320, TODAY, TODAY + timedelta(days=7), "ready"),
            ("kumari_farm", "brinjal", 80, 180, TODAY, TODAY + timedelta(days=5), "ready"),
            ("kumari_farm", "pumpkin", 200, 120, TODAY + timedelta(days=21), TODAY + timedelta(days=35), "planned"),
        ]

        for uname, crop_search, qty, price, avail_from, avail_to, status in harvests:
            user = users.get(uname)
            if not user:
                continue
            crop_id = find_crop(crop_search)
            lat, lng = COORDS.get(user.district, (8.0, 80.0))

            try:
                await db.execute(text("""
                    INSERT INTO harvest_listings (
                        id, farmer_id, crop_id, quantity_kg, price_per_kg,
                        available_from, available_to, status,
                        pickup_latitude, pickup_longitude, pickup_address,
                        created_at, updated_at
                    ) VALUES (
                        gen_random_uuid(), :farmer_id, :crop_id, :qty, :price,
                        :avail_from, :avail_to, :status,
                        :lat, :lng, :address,
                        NOW(), NOW()
                    )
                """), {
                    "farmer_id": user.id, "crop_id": crop_id, "qty": qty, "price": price,
                    "avail_from": avail_from, "avail_to": avail_to, "status": status,
                    "lat": lat, "lng": lng, "address": user.district,
                })
                harvest_count += 1
                print(f"    ADD  {uname}: {qty}kg {crop_search} @ Rs.{price}/kg")
            except Exception as e:
                print(f"    SKIP {uname}: {crop_search} — {e}")
                await db.rollback()

        # ---- DEMAND POSTINGS ----
        print("\n  Demand Postings:")

        demands = [
            ("nimal_buyer", "rice", 500, 250, TODAY + timedelta(days=14), "open"),
            ("nimal_buyer", "tomato", 100, 300, TODAY + timedelta(days=3), "open"),
            ("chaminda_buyer", "vegetable", 300, 350, TODAY + timedelta(days=7), "open"),
            ("chaminda_buyer", "onion", 200, 380, TODAY + timedelta(days=5), "open"),
        ]

        for uname, crop_search, qty, max_price, delivery_by, status in demands:
            user = users.get(uname)
            if not user:
                continue
            crop_id = find_crop(crop_search)
            lat, lng = COORDS.get(user.district, (7.0, 80.0))

            try:
                await db.execute(text("""
                    INSERT INTO demand_postings (
                        id, buyer_id, crop_id, quantity_kg, max_price_per_kg,
                        delivery_by, status,
                        sourcing_latitude, sourcing_longitude, sourcing_radius_km,
                        created_at, updated_at
                    ) VALUES (
                        gen_random_uuid(), :buyer_id, :crop_id, :qty, :max_price,
                        :delivery_by, :status,
                        :lat, :lng, :radius,
                        NOW(), NOW()
                    )
                """), {
                    "buyer_id": user.id, "crop_id": crop_id, "qty": qty, "max_price": max_price,
                    "delivery_by": delivery_by, "status": status,
                    "lat": lat, "lng": lng, "radius": 150,
                })
                demand_count += 1
                print(f"    ADD  {uname}: {qty}kg {crop_search} max Rs.{max_price}/kg")
            except Exception as e:
                print(f"    SKIP {uname}: {crop_search} — {e}")
                await db.rollback()

        # ---- SUPPLY LISTINGS ----
        print("\n  Supply Listings:")

        supplies = [
            ("sunil_supplier", "NPK Fertilizer 50kg", "fertilizer", 8500, "bag", 100),
            ("sunil_supplier", "Paddy Seeds (BG 352) 10kg", "seeds", 2200, "bag", 200),
            ("sunil_supplier", "Organic Compost 25kg", "fertilizer", 1500, "bag", 150),
            ("sunil_supplier", "Carbofuran 3G 1kg", "pesticide", 950, "kg", 50),
        ]

        for uname, name, category, price, unit, stock in supplies:
            user = users.get(uname)
            if not user:
                continue

            try:
                await db.execute(text("""
                    INSERT INTO supply_listings (
                        id, supplier_id, name, category, price, unit, stock_quantity,
                        status, created_at, updated_at
                    ) VALUES (
                        gen_random_uuid(), :supplier_id, :name, :category, :price, :unit, :stock,
                        'active', NOW(), NOW()
                    )
                """), {
                    "supplier_id": user.id, "name": name, "category": category,
                    "price": price, "unit": unit, "stock": stock,
                })
                supply_count += 1
                print(f"    ADD  {uname}: {name} Rs.{price}/{unit}")
            except Exception as e:
                print(f"    SKIP {uname}: {name} — {e}")
                await db.rollback()

        await db.commit()

    print(f"\n--- Summary ---")
    print(f"  Harvest listings: {harvest_count}")
    print(f"  Demand postings:  {demand_count}")
    print(f"  Supply listings:  {supply_count}")
    print()


if __name__ == "__main__":
    asyncio.run(seed())
