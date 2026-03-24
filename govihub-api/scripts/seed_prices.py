"""GoviHub Seed Script — 30 days of realistic LKR market price data.

Markets: Dambulla Economic Centre, Colombo Manning Market, Anuradhapura Market
Crops: Rice (Nadu), Tomato, Chili (Red), Banana (Kolikuttu)

Usage:
    python scripts/seed_prices.py

Requires DATABASE_URL in environment or .env file.
"""

import asyncio
import random
import sys
import os
from datetime import date, timedelta
from uuid import UUID

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.alerts.models import PriceHistory
from app.listings.models import CropTaxonomy

# ---------------------------------------------------------------------------
# Market definitions
# ---------------------------------------------------------------------------

MARKETS = [
    "Dambulla Economic Centre",
    "Colombo Manning Market",
    "Anuradhapura Market",
]

# ---------------------------------------------------------------------------
# Crop-specific price profiles (base price LKR/kg, daily volatility %)
# ---------------------------------------------------------------------------

CROP_PRICE_PROFILES = {
    # crop code: (base_price, volatility_pct, seasonal_factor)
    "RICE_NADU": {
        "base_price": 115.0,      # LKR/kg — typical Nadu rice
        "volatility": 0.03,       # 3% daily volatility
        "market_offsets": {
            "Dambulla Economic Centre": 0.0,
            "Colombo Manning Market": 8.0,    # Higher in Colombo
            "Anuradhapura Market": -5.0,      # Cheaper in farming belt
        },
    },
    "TOMATO": {
        "base_price": 180.0,      # LKR/kg — highly seasonal
        "volatility": 0.08,       # 8% daily volatility
        "market_offsets": {
            "Dambulla Economic Centre": 0.0,
            "Colombo Manning Market": 25.0,
            "Anuradhapura Market": -15.0,
        },
    },
    "CHILI_RED": {
        "base_price": 650.0,      # LKR/kg — premium spice
        "volatility": 0.06,       # 6% daily volatility
        "market_offsets": {
            "Dambulla Economic Centre": 0.0,
            "Colombo Manning Market": 40.0,
            "Anuradhapura Market": -20.0,
        },
    },
    "BANANA_KOLIKUTTU": {
        "base_price": 95.0,       # LKR/kg — popular banana variety
        "volatility": 0.04,       # 4% daily volatility
        "market_offsets": {
            "Dambulla Economic Centre": 0.0,
            "Colombo Manning Market": 12.0,
            "Anuradhapura Market": -8.0,
        },
    },
}

# Fallback for generic crop codes that might exist in DB
GENERIC_PROFILE = {
    "base_price": 100.0,
    "volatility": 0.05,
    "market_offsets": {
        "Dambulla Economic Centre": 0.0,
        "Colombo Manning Market": 15.0,
        "Anuradhapura Market": -10.0,
    },
}


def _get_profile(crop_code: str) -> dict:
    """Map a DB crop code to a price profile (case-insensitive partial match)."""
    code_upper = crop_code.upper()
    for key in CROP_PRICE_PROFILES:
        if key in code_upper or code_upper in key:
            return CROP_PRICE_PROFILES[key]
    # Fallback by crop name patterns
    if "RICE" in code_upper or "PADI" in code_upper:
        return CROP_PRICE_PROFILES["RICE_NADU"]
    if "TOMATO" in code_upper:
        return CROP_PRICE_PROFILES["TOMATO"]
    if "CHILI" in code_upper or "PEPPER" in code_upper:
        return CROP_PRICE_PROFILES["CHILI_RED"]
    if "BANANA" in code_upper or "KELAPA" in code_upper:
        return CROP_PRICE_PROFILES["BANANA_KOLIKUTTU"]
    return GENERIC_PROFILE


def _generate_prices_for_crop(
    crop_id: UUID,
    crop_code: str,
    days: int = 30,
) -> list[dict]:
    """Generate synthetic daily price records for a crop across all markets."""
    profile = _get_profile(crop_code)
    base = profile["base_price"]
    volatility = profile["volatility"]
    market_offsets = profile["market_offsets"]

    records = []
    today = date.today()

    random.seed(str(crop_id))  # Deterministic per crop for repeatability

    for market in MARKETS:
        market_base = base + market_offsets.get(market, 0.0)
        current_price = market_base

        for day_offset in range(days, 0, -1):
            record_date = today - timedelta(days=day_offset)

            # Random walk with mean reversion
            daily_change = random.gauss(0, volatility)
            # Mean reversion pull
            reversion = (market_base - current_price) / market_base * 0.1
            current_price = current_price * (1 + daily_change + reversion)

            # Clamp to reasonable range (50% below to 200% above base)
            current_price = max(market_base * 0.5, min(market_base * 2.0, current_price))

            records.append({
                "crop_id": crop_id,
                "market_name": market,
                "price_per_kg": round(current_price, 2),
                "unit": "LKR",
                "recorded_date": record_date,
                "source": "seed_data",
            })

    return records


async def seed_prices(session: AsyncSession):
    """Seed price history for key crops."""

    # Find target crops from DB
    result = await session.execute(
        select(CropTaxonomy).where(CropTaxonomy.is_active.is_(True))
    )
    all_crops = result.scalars().all()

    if not all_crops:
        print("ERROR: No crops found in crop_taxonomy table. Run seed_crops.py first.")
        return

    # Filter to target crops (rice, tomato, chili, banana)
    target_keywords = ["rice", "tomato", "chili", "banana", "padi"]
    target_crops = [
        c for c in all_crops
        if any(kw in c.name_en.lower() or kw in c.code.lower() for kw in target_keywords)
    ]

    # If no matches found, use first 4 crops as fallback
    if not target_crops:
        print("WARNING: Target crops not found by name. Using first 4 active crops as fallback.")
        target_crops = all_crops[:4]

    print(f"Seeding prices for {len(target_crops)} crops across {len(MARKETS)} markets, 30 days each...")

    inserted_count = 0
    skipped_count = 0

    for crop in target_crops:
        print(f"  Processing: {crop.name_en} ({crop.code})")
        records = _generate_prices_for_crop(crop.id, crop.code, days=30)

        for rec in records:
            # Check for existing record (avoid duplicate seeding)
            existing = await session.execute(
                select(PriceHistory).where(
                    PriceHistory.crop_id == rec["crop_id"],
                    PriceHistory.market_name == rec["market_name"],
                    PriceHistory.recorded_date == rec["recorded_date"],
                    PriceHistory.source == "seed_data",
                )
            )
            if existing.scalar_one_or_none():
                skipped_count += 1
                continue

            ph = PriceHistory(**rec)
            session.add(ph)
            inserted_count += 1

    await session.commit()
    print(f"\nDone! Inserted: {inserted_count}, Skipped (already exists): {skipped_count}")


async def main():
    """Entry point."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        await seed_prices(session)

    await engine.dispose()
    print("Price seed complete.")


if __name__ == "__main__":
    asyncio.run(main())
