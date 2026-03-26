"""Seed beta marketplace data -- harvest listings, demand postings, supply listings.

Usage:
    python scripts/seed_beta_data.py

Idempotent -- checks for existing data before inserting.
Requires beta users to be seeded first (seed_beta_users.py).
"""

import asyncio
import sys
import os
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, func
import app.models  # noqa: register all models
from app.database import async_session_factory
from app.users.models import User
from app.listings.models import (
    HarvestListing, HarvestStatus,
    DemandPosting, DemandStatus,
    CropTaxonomy,
)
from app.marketplace.models import SupplyListing, SupplyCategory, SupplyStatus
from app.matching.models import Match, MatchStatus


# Coordinates
COORDS = {
    "Anuradhapura": (8.3114, 80.4037),
    "Polonnaruwa": (7.9403, 81.0188),
    "Colombo": (6.9271, 79.8612),
    "Kurunegala": (7.4863, 80.3647),
}


def make_point(district):
    """Return a WKT POINT string for a district."""
    lat, lon = COORDS[district]
    return f"SRID=4326;POINT({lon} {lat})"


async def get_user(db, username):
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def get_crop(db, name_en):
    """Look up crop by exact name, then partial match, then keyword."""
    # Try exact match first
    result = await db.execute(
        select(CropTaxonomy).where(func.lower(CropTaxonomy.name_en) == name_en.lower())
    )
    crop = result.scalar_one_or_none()
    if crop:
        return crop

    # Try ILIKE partial match (e.g., "Samba Rice" matches "Paddy (Samba)")
    result = await db.execute(
        select(CropTaxonomy).where(CropTaxonomy.name_en.ilike(f"%{name_en}%")).limit(1)
    )
    crop = result.scalar_one_or_none()
    if crop:
        return crop

    # Try keyword match (e.g., "Nadu Rice" → search for "Nadu")
    keyword = name_en.split()[0] if " " in name_en else name_en
    result = await db.execute(
        select(CropTaxonomy).where(CropTaxonomy.name_en.ilike(f"%{keyword}%")).limit(1)
    )
    return result.scalar_one_or_none()


async def get_fallback_crop_id(db):
    result = await db.execute(select(CropTaxonomy.id).limit(1))
    return result.scalar()


async def seed():
    print("\n" + "=" * 48)
    print("  GoviHub Beta -- Seeding Market Data")
    print("=" * 48 + "\n")

    today = date.today()
    harvest_count = 0
    demand_count = 0
    supply_count = 0
    match_count = 0

    async with async_session_factory() as db:
        # Resolve users
        kamal = await get_user(db, "kamal_farmer")
        saman = await get_user(db, "saman_goviya")
        kumari = await get_user(db, "kumari_farm")
        nimal = await get_user(db, "nimal_buyer")
        chaminda = await get_user(db, "chaminda_buyer")
        sunil = await get_user(db, "sunil_supplier")

        missing = []
        for name, user in [
            ("kamal_farmer", kamal), ("saman_goviya", saman),
            ("kumari_farm", kumari), ("nimal_buyer", nimal),
            ("chaminda_buyer", chaminda), ("sunil_supplier", sunil),
        ]:
            if not user:
                missing.append(name)
        if missing:
            print(f"  ERROR: Missing users: {', '.join(missing)}")
            print("  Run seed_beta_users.py first!")
            return

        fallback_crop_id = await get_fallback_crop_id(db)

        # Resolve crop IDs
        crop_names = [
            "Samba Rice", "Big Onion", "Green Chili", "Nadu Rice",
            "Tomato", "Long Bean", "Brinjal", "Pumpkin",
        ]
        crop_map = {}
        for cn in crop_names:
            crop = await get_crop(db, cn)
            if crop:
                crop_map[cn] = crop.id
            else:
                print(f"  WARN  Crop '{cn}' not found in taxonomy, using fallback")
                crop_map[cn] = fallback_crop_id

        def cid(name):
            return crop_map.get(name, fallback_crop_id)

        # ---- HARVEST LISTINGS (idempotent check) ----
        existing_harvests = (await db.execute(
            select(func.count()).select_from(HarvestListing).where(
                HarvestListing.farmer_id.in_([kamal.id, saman.id, kumari.id])
            )
        )).scalar()

        if existing_harvests and existing_harvests > 0:
            print(f"  SKIP  Harvest listings ({existing_harvests} already exist)")
        else:
            harvest_data = [
                # Kamal: 500kg Samba Rice
                dict(
                    farmer_id=kamal.id, crop_id=cid("Samba Rice"), variety="Samba",
                    quantity_kg=500, price_per_kg=220, quality_grade="A",
                    harvest_date=today - timedelta(days=5),
                    available_from=today, available_until=today + timedelta(days=30),
                    location=make_point("Anuradhapura"),
                    description="Fresh Samba rice from Anuradhapura. Organically grown, sun-dried.",
                    status=HarvestStatus.ready, is_organic=True,
                    delivery_available=True, delivery_radius_km=50,
                ),
                # Kamal: 200kg Big Onions
                dict(
                    farmer_id=kamal.id, crop_id=cid("Big Onion"), variety="Big Onion",
                    quantity_kg=200, price_per_kg=350, quality_grade="A",
                    harvest_date=today - timedelta(days=3),
                    available_from=today, available_until=today + timedelta(days=14),
                    location=make_point("Anuradhapura"),
                    description="Large red onions, well-cured and ready for market.",
                    status=HarvestStatus.ready, is_organic=False,
                    delivery_available=False,
                ),
                # Kamal: 100kg Green Chili
                dict(
                    farmer_id=kamal.id, crop_id=cid("Green Chili"), variety="MI Green",
                    quantity_kg=100, price_per_kg=480, quality_grade="B",
                    harvest_date=today - timedelta(days=1),
                    available_from=today, available_until=today + timedelta(days=7),
                    location=make_point("Anuradhapura"),
                    description="Fresh green chilies. Spicy MI variety.",
                    status=HarvestStatus.ready, is_organic=False,
                    delivery_available=True, delivery_radius_km=30,
                ),
                # Saman: 1000kg Nadu Rice
                dict(
                    farmer_id=saman.id, crop_id=cid("Nadu Rice"), variety="Nadu",
                    quantity_kg=1000, price_per_kg=195, quality_grade="A",
                    harvest_date=today - timedelta(days=7),
                    available_from=today, available_until=today + timedelta(days=45),
                    location=make_point("Polonnaruwa"),
                    description="Premium Nadu rice from Polonnaruwa irrigated fields. Bulk available.",
                    status=HarvestStatus.ready, is_organic=False,
                    delivery_available=True, delivery_radius_km=100,
                ),
                # Saman: 300kg Tomatoes
                dict(
                    farmer_id=saman.id, crop_id=cid("Tomato"), variety="Thilina",
                    quantity_kg=300, price_per_kg=280, quality_grade="A",
                    harvest_date=today,
                    available_from=today, available_until=today + timedelta(days=10),
                    location=make_point("Polonnaruwa"),
                    description="Vine-ripened Thilina tomatoes. Firm and red.",
                    status=HarvestStatus.ready, is_organic=False,
                    delivery_available=False,
                ),
                # Kumari: 150kg Long Beans
                dict(
                    farmer_id=kumari.id, crop_id=cid("Long Bean"), variety="Local",
                    quantity_kg=150, price_per_kg=320, quality_grade="A",
                    harvest_date=today - timedelta(days=2),
                    available_from=today, available_until=today + timedelta(days=7),
                    location=make_point("Anuradhapura"),
                    description="Fresh long beans, hand-picked daily from home garden.",
                    status=HarvestStatus.ready, is_organic=True,
                    delivery_available=False,
                ),
                # Kumari: 80kg Brinjal
                dict(
                    farmer_id=kumari.id, crop_id=cid("Brinjal"), variety="Purple Long",
                    quantity_kg=80, price_per_kg=260, quality_grade="B",
                    harvest_date=today - timedelta(days=1),
                    available_from=today, available_until=today + timedelta(days=10),
                    location=make_point("Anuradhapura"),
                    description="Purple long brinjal, ideal for curry.",
                    status=HarvestStatus.ready, is_organic=True,
                    delivery_available=False,
                ),
                # Kumari: 200kg Pumpkin
                dict(
                    farmer_id=kumari.id, crop_id=cid("Pumpkin"), variety="Butternut",
                    quantity_kg=200, price_per_kg=120, quality_grade="A",
                    harvest_date=today + timedelta(days=5),
                    available_from=today + timedelta(days=5),
                    available_until=today + timedelta(days=30),
                    location=make_point("Anuradhapura"),
                    description="Large butternut pumpkins, maturing on the vine. Available next week.",
                    status=HarvestStatus.planned, is_organic=True,
                    delivery_available=True, delivery_radius_km=25,
                ),
            ]

            for h in harvest_data:
                db.add(HarvestListing(**h))
                harvest_count += 1
            print(f"  ADD   {harvest_count} harvest listings")

        # ---- DEMAND POSTINGS (idempotent check) ----
        existing_demands = (await db.execute(
            select(func.count()).select_from(DemandPosting).where(
                DemandPosting.buyer_id.in_([nimal.id, chaminda.id])
            )
        )).scalar()

        if existing_demands and existing_demands > 0:
            print(f"  SKIP  Demand postings ({existing_demands} already exist)")
        else:
            demand_data = [
                # Nimal: 500kg Rice
                dict(
                    buyer_id=nimal.id, crop_id=cid("Samba Rice"),
                    variety="Any rice variety",
                    quantity_kg=500, max_price_per_kg=230, quality_grade="A",
                    needed_by=today + timedelta(days=14),
                    location=make_point("Colombo"), radius_km=150,
                    description="Need 500kg of quality rice for distribution. Samba or Nadu preferred.",
                    status=DemandStatus.open, is_recurring=True,
                    recurrence_pattern={"frequency": "biweekly", "quantity_kg": 500},
                ),
                # Nimal: 100kg Tomatoes
                dict(
                    buyer_id=nimal.id, crop_id=cid("Tomato"),
                    quantity_kg=100, max_price_per_kg=300, quality_grade="A",
                    needed_by=today + timedelta(days=7),
                    location=make_point("Colombo"), radius_km=150,
                    description="Fresh firm tomatoes for restaurant supply chain.",
                    status=DemandStatus.open, is_recurring=False,
                ),
                # Chaminda: 300kg Mixed Vegetables
                dict(
                    buyer_id=chaminda.id, crop_id=cid("Long Bean"),
                    variety="Mixed vegetables",
                    quantity_kg=300, max_price_per_kg=350, quality_grade="A",
                    needed_by=today + timedelta(days=10),
                    location=make_point("Colombo"), radius_km=200,
                    description="Mixed vegetable lot for supermarket shelves - beans, brinjal, pumpkin.",
                    status=DemandStatus.open, is_recurring=True,
                    recurrence_pattern={"frequency": "weekly", "quantity_kg": 300},
                ),
                # Chaminda: 200kg Onions
                dict(
                    buyer_id=chaminda.id, crop_id=cid("Big Onion"),
                    quantity_kg=200, max_price_per_kg=380, quality_grade="A",
                    needed_by=today + timedelta(days=21),
                    location=make_point("Colombo"), radius_km=200,
                    description="Large red onions for supermarket chain. Consistent supply needed.",
                    status=DemandStatus.open, is_recurring=True,
                    recurrence_pattern={"frequency": "monthly", "quantity_kg": 200},
                ),
            ]

            for d in demand_data:
                db.add(DemandPosting(**d))
                demand_count += 1
            print(f"  ADD   {demand_count} demand postings")

        # ---- SUPPLY LISTINGS (idempotent check) ----
        existing_supplies = (await db.execute(
            select(func.count()).select_from(SupplyListing).where(
                SupplyListing.supplier_id == sunil.id
            )
        )).scalar()

        if existing_supplies and existing_supplies > 0:
            print(f"  SKIP  Supply listings ({existing_supplies} already exist)")
        else:
            supply_data = [
                # NPK Fertilizer
                dict(
                    supplier_id=sunil.id,
                    name="NPK Fertilizer (50kg bag)",
                    name_si="NPK pohora (kilo 50 malla)",
                    description="High-quality NPK 15-15-15 compound fertilizer. Suitable for all crops.",
                    category=SupplyCategory.fertilizer,
                    price=8500, unit="bag", stock_quantity=200,
                    location=make_point("Kurunegala"),
                    delivery_available=True, delivery_radius_km=100,
                    status=SupplyStatus.active,
                ),
                # Paddy Seeds
                dict(
                    supplier_id=sunil.id,
                    name="Paddy Seeds - BG 352 (5kg pack)",
                    name_si="Vee beeja - BG 352 (kilo 5 asuruma)",
                    description="Certified BG 352 paddy seeds. High yield variety for Yala and Maha seasons.",
                    category=SupplyCategory.seeds,
                    price=2200, unit="pack", stock_quantity=500,
                    location=make_point("Kurunegala"),
                    delivery_available=True, delivery_radius_km=150,
                    status=SupplyStatus.active,
                ),
                # Organic Compost
                dict(
                    supplier_id=sunil.id,
                    name="Organic Compost (25kg bag)",
                    name_si="Kabanika compost (kilo 25 malla)",
                    description="Premium organic compost from cow dung and plant matter. SLSI certified.",
                    category=SupplyCategory.fertilizer,
                    price=1500, unit="bag", stock_quantity=350,
                    location=make_point("Kurunegala"),
                    delivery_available=True, delivery_radius_km=75,
                    status=SupplyStatus.active,
                ),
                # Carbofuran
                dict(
                    supplier_id=sunil.id,
                    name="Carbofuran 3G (1kg pack)",
                    name_si="Carbofuran 3G (kilo 1 asuruma)",
                    description="Granular insecticide for paddy stem borer and brown planthopper control.",
                    category=SupplyCategory.pesticide,
                    price=950, unit="pack", stock_quantity=150,
                    location=make_point("Kurunegala"),
                    delivery_available=False,
                    status=SupplyStatus.active,
                ),
            ]

            for s in supply_data:
                db.add(SupplyListing(**s))
                supply_count += 1
            print(f"  ADD   {supply_count} supply listings")

        await db.commit()

        # ---- MATCHES (idempotent check) ----
        existing_matches = (await db.execute(
            select(func.count()).select_from(Match)
        )).scalar()

        if existing_matches and existing_matches > 0:
            print(f"  SKIP  Matches ({existing_matches} already exist)")
        else:
            # Look up harvests by farmer + crop to get IDs
            def harvest_q(farmer_id, crop_name):
                return select(HarvestListing).where(
                    HarvestListing.farmer_id == farmer_id,
                    HarvestListing.crop_id == cid(crop_name),
                )

            def demand_q(buyer_id, crop_name):
                return select(DemandPosting).where(
                    DemandPosting.buyer_id == buyer_id,
                    DemandPosting.crop_id == cid(crop_name),
                )

            kamal_chili = (await db.execute(harvest_q(kamal.id, "Green Chili").limit(1))).scalar_one_or_none()
            saman_tomato = (await db.execute(harvest_q(saman.id, "Tomato").limit(1))).scalar_one_or_none()
            saman_nadu = (await db.execute(harvest_q(saman.id, "Nadu Rice").limit(1))).scalar_one_or_none()
            kumari_beans = (await db.execute(harvest_q(kumari.id, "Long Bean").limit(1))).scalar_one_or_none()

            nimal_tomato = (await db.execute(demand_q(nimal.id, "Tomato").limit(1))).scalar_one_or_none()
            nimal_rice = (await db.execute(demand_q(nimal.id, "Samba Rice").limit(1))).scalar_one_or_none()
            chaminda_mixed = (await db.execute(demand_q(chaminda.id, "Long Bean").limit(1))).scalar_one_or_none()
            chaminda_onion = (await db.execute(demand_q(chaminda.id, "Big Onion").limit(1))).scalar_one_or_none()

            match_specs = []

            # 1. Kamal's Green Chili ↔ Chaminda's Mixed Veg → 0.85, proposed
            if kamal_chili and chaminda_mixed:
                match_specs.append(dict(
                    harvest_id=kamal_chili.id, demand_id=chaminda_mixed.id,
                    score=0.85, status=MatchStatus.proposed,
                    score_breakdown={"crop": 0.7, "location": 0.9, "price": 0.95},
                ))

            # 2. Saman's Tomato ↔ Nimal's Tomato → 0.92, accepted_farmer
            if saman_tomato and nimal_tomato:
                match_specs.append(dict(
                    harvest_id=saman_tomato.id, demand_id=nimal_tomato.id,
                    score=0.92, status=MatchStatus.accepted_farmer,
                    score_breakdown={"crop": 1.0, "location": 0.85, "price": 0.9},
                    agreed_price_per_kg=285.0,
                ))

            # 3. Saman's Nadu Rice ↔ Nimal's Rice demand → 0.78, confirmed
            if saman_nadu and nimal_rice:
                match_specs.append(dict(
                    harvest_id=saman_nadu.id, demand_id=nimal_rice.id,
                    score=0.78, status=MatchStatus.confirmed,
                    score_breakdown={"crop": 0.8, "location": 0.7, "price": 0.85},
                    agreed_price_per_kg=210.0, agreed_quantity_kg=500.0,
                ))

            # 4. Kumari's Long Beans ↔ Chaminda's Mixed Veg → 0.65, proposed
            if kumari_beans and chaminda_mixed:
                match_specs.append(dict(
                    harvest_id=kumari_beans.id, demand_id=chaminda_mixed.id,
                    score=0.65, status=MatchStatus.proposed,
                    score_breakdown={"crop": 0.9, "location": 0.5, "price": 0.55},
                ))

            for m in match_specs:
                db.add(Match(**m))
                match_count += 1

            if match_count:
                await db.commit()
                print(f"  ADD   {match_count} matches")
            else:
                print("  WARN  Could not create matches (missing harvests or demands)")

    # Summary
    print("\n" + "-" * 48)
    print("  Beta Data Summary")
    print("-" * 48)
    print(f"  Harvest Listings  : {harvest_count}")
    print(f"  Demand Postings   : {demand_count}")
    print(f"  Supply Listings   : {supply_count}")
    print(f"  Matches           : {match_count}")
    print("-" * 48 + "\n")


if __name__ == "__main__":
    asyncio.run(seed())
