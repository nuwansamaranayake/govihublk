"""GoviHub Spice Crop Seeder — Ensure all 8 spice crops exist in crop_taxonomy."""

import asyncio
import sys
from pathlib import Path

import structlog

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app.models  # noqa: register all models
from app.database import async_session_factory
from app.listings.models import CropTaxonomy

logger = structlog.get_logger()

# Full set of 8 spice crops for the spices pilot.
# 5 already exist in seed_crops.py; 3 are new (nutmeg, cardamom, mixed_spices).
SPICE_CROPS = [
    {"code": "SPC-PPR-001", "name_en": "Black Pepper", "name_si": "\u0d9c\u0db8\u0dca\u0db8\u0dd2\u0dbb\u0dd2\u0dc3\u0dca", "name_ta": "\u0bae\u0bbf\u0bb3\u0b95\u0bc1", "category": "spice", "season": {"yala": True, "maha": True}, "avg_yield_kg": 2000},
    {"code": "SPC-TRM-001", "name_en": "Turmeric", "name_si": "\u0d9a\u0dc4", "name_ta": "\u0bae\u0b9e\u0bcd\u0b9a\u0bb3\u0bcd", "category": "spice", "season": {"yala": False, "maha": True}, "avg_yield_kg": 5000},
    {"code": "SPC-GNG-001", "name_en": "Ginger", "name_si": "\u0d89\u0d9f\u0dd4\u0dbb\u0dd4", "name_ta": "\u0b87\u0b9e\u0bcd\u0b9a\u0bbf", "category": "spice", "season": {"yala": False, "maha": True}, "avg_yield_kg": 8000},
    {"code": "SPC-CLV-001", "name_en": "Clove", "name_si": "\u0d9a\u0dbb\u0dcf\u0db6\u0dd4 \u0db1\u0dd0\u0da7\u0dd2", "name_ta": "\u0b95\u0bbf\u0bb0\u0bbe\u0bae\u0bcd\u0baa\u0bc1", "category": "spice", "season": {"yala": True, "maha": True}, "avg_yield_kg": 500},
    {"code": "SPC-NTM-001", "name_en": "Nutmeg", "name_si": "\u0dc3\u0dcf\u0daf\u0dd2\u0d9a\u0dca\u0d9a\u0dcf", "name_ta": "\u0b9c\u0bbe\u0ba4\u0bbf\u0b95\u0bcd\u0b95\u0bbe\u0baf\u0bcd", "category": "spice", "season": {"yala": True, "maha": True}, "avg_yield_kg": 800},
    {"code": "SPC-CDM-001", "name_en": "Cardamom", "name_si": "\u0d91\u0db1\u0dc3\u0dcf\u0dbd\u0dca", "name_ta": "\u0b8f\u0bb2\u0b95\u0bcd\u0b95\u0bbe\u0baf\u0bcd", "category": "spice", "season": {"yala": True, "maha": True}, "avg_yield_kg": 300},
    {"code": "SPC-CIN-001", "name_en": "Cinnamon", "name_si": "\u0d9a\u0dd4\u0dbb\u0dd4\u0daf\u0dd4", "name_ta": "\u0b87\u0bb2\u0bb5\u0b99\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0bc8", "category": "spice", "season": {"yala": True, "maha": True}, "avg_yield_kg": 1500},
    {"code": "SPC-MIX-001", "name_en": "Mixed Spices", "name_si": "\u0db8\u0dd2\u0dc1\u0dca\u200d\u0dbb \u0d9a\u0dd4\u0dc5\u0dd4\u0db6\u0da9\u0dd4", "name_ta": "\u0b95\u0bb2\u0bb5\u0bc8 \u0bae\u0b9a\u0bbe\u0bb2\u0bbe", "category": "spice", "season": {"yala": True, "maha": True}, "avg_yield_kg": 0},
]


async def seed_spice_crops():
    """Insert spice crops into crop_taxonomy table (idempotent)."""
    async with async_session_factory() as session:
        from sqlalchemy import select

        inserted = 0
        skipped = 0

        for crop_data in SPICE_CROPS:
            result = await session.execute(
                select(CropTaxonomy).where(CropTaxonomy.code == crop_data["code"])
            )
            existing = result.scalar_one_or_none()

            if existing:
                skipped += 1
                logger.debug("spice_crop_skipped", code=crop_data["code"])
                continue

            crop = CropTaxonomy(**crop_data)
            session.add(crop)
            inserted += 1
            logger.info("spice_crop_inserted", code=crop_data["code"], name=crop_data["name_en"])

        await session.commit()
        logger.info("seed_spice_crops_complete", inserted=inserted, skipped=skipped, total=len(SPICE_CROPS))


if __name__ == "__main__":
    asyncio.run(seed_spice_crops())
