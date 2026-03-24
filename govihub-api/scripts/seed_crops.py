"""GoviHub Crop Taxonomy Seeder — 35+ Sri Lankan crops with Sinhala names."""

import asyncio
import sys
from pathlib import Path

import structlog

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.database import async_session_factory
from app.listings.models import CropTaxonomy

logger = structlog.get_logger()

CROPS = [
    # Vegetables
    {"code": "VEG-TOM-001", "name_en": "Tomato", "name_si": "තක්කාලි", "name_ta": "தக்காளி", "category": "vegetable", "season": {"yala": True, "maha": True}, "avg_yield_kg": 20000},
    {"code": "VEG-BRN-001", "name_en": "Brinjal / Eggplant", "name_si": "වම්බටු", "name_ta": "கத்தரிக்காய்", "category": "vegetable", "season": {"yala": True, "maha": True}, "avg_yield_kg": 15000},
    {"code": "VEG-OKR-001", "name_en": "Okra / Ladies Finger", "name_si": "බණ්ඩක්කා", "name_ta": "வெண்டைக்காய்", "category": "vegetable", "season": {"yala": True, "maha": True}, "avg_yield_kg": 10000},
    {"code": "VEG-LBN-001", "name_en": "Long Beans", "name_si": "මෑ", "name_ta": "நீள் பீன்ஸ்", "category": "vegetable", "season": {"yala": True, "maha": True}, "avg_yield_kg": 8000},
    {"code": "VEG-SKG-001", "name_en": "Snake Gourd", "name_si": "පතෝල", "name_ta": "புடலங்காய்", "category": "vegetable", "season": {"yala": True, "maha": False}, "avg_yield_kg": 12000},
    {"code": "VEG-BTG-001", "name_en": "Bitter Gourd", "name_si": "කරවිල", "name_ta": "பாகற்காய்", "category": "vegetable", "season": {"yala": True, "maha": True}, "avg_yield_kg": 10000},
    {"code": "VEG-PMP-001", "name_en": "Pumpkin", "name_si": "වට්ටක්කා", "name_ta": "பூசணிக்காய்", "category": "vegetable", "season": {"yala": True, "maha": True}, "avg_yield_kg": 25000},
    {"code": "VEG-CUC-001", "name_en": "Cucumber", "name_si": "පිපිඤ්ඤා", "name_ta": "வெள்ளரிக்காய்", "category": "vegetable", "season": {"yala": True, "maha": True}, "avg_yield_kg": 18000},
    {"code": "VEG-WBN-001", "name_en": "Winged Bean", "name_si": "දඹල", "name_ta": "சிறகவரை", "category": "vegetable", "season": {"yala": True, "maha": False}, "avg_yield_kg": 5000},
    {"code": "VEG-MRN-001", "name_en": "Drumstick / Moringa", "name_si": "මුරුංගා", "name_ta": "முருங்கை", "category": "vegetable", "season": {"yala": True, "maha": True}, "avg_yield_kg": 15000},
    {"code": "VEG-GCH-001", "name_en": "Green Chili", "name_si": "අමු මිරිස්", "name_ta": "பச்சை மிளகாய்", "category": "vegetable", "season": {"yala": True, "maha": True}, "avg_yield_kg": 8000},
    {"code": "VEG-CAP-001", "name_en": "Capsicum", "name_si": "මාළු මිරිස්", "name_ta": "குடமிளகாய்", "category": "vegetable", "season": {"yala": True, "maha": False}, "avg_yield_kg": 12000},
    {"code": "VEG-SPG-001", "name_en": "Spinach (Nivithi)", "name_si": "නිවිති", "name_ta": "பசலை", "category": "vegetable", "season": {"yala": True, "maha": True}, "avg_yield_kg": 6000},

    # Fruits
    {"code": "FRT-BAN-001", "name_en": "Banana (Ambul)", "name_si": "අඹුල් කෙසෙල්", "name_ta": "வாழை", "category": "fruit", "season": {"yala": True, "maha": True}, "avg_yield_kg": 30000},
    {"code": "FRT-BAN-002", "name_en": "Banana (Kolikuttu)", "name_si": "කොලිකුට්ටු කෙසෙල්", "name_ta": "ரஸ்தாளி", "category": "fruit", "season": {"yala": True, "maha": True}, "avg_yield_kg": 25000},
    {"code": "FRT-MNG-001", "name_en": "Mango", "name_si": "අඹ", "name_ta": "மாங்காய்", "category": "fruit", "season": {"yala": True, "maha": False}, "avg_yield_kg": 15000},
    {"code": "FRT-PAP-001", "name_en": "Papaya", "name_si": "පැපොල්", "name_ta": "பப்பாளி", "category": "fruit", "season": {"yala": True, "maha": True}, "avg_yield_kg": 40000},
    {"code": "FRT-WTM-001", "name_en": "Watermelon", "name_si": "කොමඩු", "name_ta": "தர்பூசணி", "category": "fruit", "season": {"yala": True, "maha": False}, "avg_yield_kg": 35000},
    {"code": "FRT-COC-001", "name_en": "Coconut", "name_si": "පොල්", "name_ta": "தேங்காய்", "category": "fruit", "season": {"yala": True, "maha": True}, "avg_yield_kg": 10000},
    {"code": "FRT-LIM-001", "name_en": "Lime", "name_si": "දෙහි", "name_ta": "எலுமிச்சை", "category": "fruit", "season": {"yala": True, "maha": True}, "avg_yield_kg": 8000},
    {"code": "FRT-GUA-001", "name_en": "Guava", "name_si": "පේර", "name_ta": "கொய்யா", "category": "fruit", "season": {"yala": True, "maha": True}, "avg_yield_kg": 15000},

    # Grains
    {"code": "GRN-PAD-001", "name_en": "Paddy (Samba)", "name_si": "සම්බා වී", "name_ta": "சம்பா நெல்", "category": "grain", "season": {"yala": True, "maha": True}, "avg_yield_kg": 4500},
    {"code": "GRN-PAD-002", "name_en": "Paddy (Nadu)", "name_si": "නාඩු වී", "name_ta": "நாடு நெல்", "category": "grain", "season": {"yala": True, "maha": True}, "avg_yield_kg": 5000},
    {"code": "GRN-PAD-003", "name_en": "Paddy (Red Rice)", "name_si": "රතු කැකුළු වී", "name_ta": "சிவப்பு அரிசி நெல்", "category": "grain", "season": {"yala": True, "maha": True}, "avg_yield_kg": 4000},
    {"code": "GRN-MZE-001", "name_en": "Maize / Corn", "name_si": "බඩ ඉරිඟු", "name_ta": "சோளம்", "category": "grain", "season": {"yala": True, "maha": True}, "avg_yield_kg": 5000},

    # Pulses
    {"code": "PLS-MNG-001", "name_en": "Green Gram / Mung Bean", "name_si": "මුං", "name_ta": "பயறு", "category": "pulse", "season": {"yala": True, "maha": True}, "avg_yield_kg": 1200},
    {"code": "PLS-CWP-001", "name_en": "Cowpea", "name_si": "කවුපි", "name_ta": "தட்டைப்பயறு", "category": "pulse", "season": {"yala": True, "maha": True}, "avg_yield_kg": 1500},
    {"code": "PLS-BLG-001", "name_en": "Black Gram", "name_si": "උඳු", "name_ta": "உளுந்து", "category": "pulse", "season": {"yala": True, "maha": False}, "avg_yield_kg": 1000},
    {"code": "PLS-SOY-001", "name_en": "Soybean", "name_si": "සෝයා බෝංචි", "name_ta": "சோயா", "category": "pulse", "season": {"yala": True, "maha": False}, "avg_yield_kg": 2000},
    {"code": "PLS-GNT-001", "name_en": "Groundnut", "name_si": "රට කජු", "name_ta": "நிலக்கடலை", "category": "pulse", "season": {"yala": True, "maha": False}, "avg_yield_kg": 2500},

    # Spices
    {"code": "SPC-TRM-001", "name_en": "Turmeric", "name_si": "කහ", "name_ta": "மஞ்சள்", "category": "spice", "season": {"yala": False, "maha": True}, "avg_yield_kg": 5000},
    {"code": "SPC-GNG-001", "name_en": "Ginger", "name_si": "ඉඟුරු", "name_ta": "இஞ்சி", "category": "spice", "season": {"yala": False, "maha": True}, "avg_yield_kg": 8000},
    {"code": "SPC-PPR-001", "name_en": "Black Pepper", "name_si": "ගම්මිරිස්", "name_ta": "மிளகு", "category": "spice", "season": {"yala": True, "maha": True}, "avg_yield_kg": 2000},
    {"code": "SPC-CIN-001", "name_en": "Cinnamon", "name_si": "කුරුඳු", "name_ta": "இலவங்கப்பட்டை", "category": "spice", "season": {"yala": True, "maha": True}, "avg_yield_kg": 1500},
    {"code": "SPC-CLV-001", "name_en": "Clove", "name_si": "කරාබු නැටි", "name_ta": "கிராம்பு", "category": "spice", "season": {"yala": True, "maha": True}, "avg_yield_kg": 500},
]


async def seed_crops():
    """Insert crops into crop_taxonomy table (idempotent)."""
    async with async_session_factory() as session:
        inserted = 0
        skipped = 0

        for crop_data in CROPS:
            from sqlalchemy import select
            result = await session.execute(
                select(CropTaxonomy).where(CropTaxonomy.code == crop_data["code"])
            )
            existing = result.scalar_one_or_none()

            if existing:
                skipped += 1
                logger.debug("crop_skipped", code=crop_data["code"])
                continue

            crop = CropTaxonomy(**crop_data)
            session.add(crop)
            inserted += 1
            logger.info("crop_inserted", code=crop_data["code"], name=crop_data["name_en"])

        await session.commit()
        logger.info("seed_crops_complete", inserted=inserted, skipped=skipped, total=len(CROPS))


if __name__ == "__main__":
    asyncio.run(seed_crops())
