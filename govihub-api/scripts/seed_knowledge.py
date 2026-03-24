"""GoviHub Knowledge Base Seeder — Sample agricultural knowledge chunks."""

import asyncio
import sys
from pathlib import Path

import structlog

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.database import async_session_factory
from app.advisory.models import KnowledgeChunk

logger = structlog.get_logger()

# Sample knowledge chunks — will be expanded with full knowledge base
SAMPLE_CHUNKS = [
    {
        "source": "sri_lanka_rice_guide",
        "title": "Rice Cultivation Best Practices - Land Preparation",
        "content": (
            "Rice cultivation in the dry zone of Sri Lanka (Anuradhapura, Polonnaruwa) requires "
            "careful land preparation. Begin with plowing 2-3 weeks before planting during the Maha "
            "season (October-March) or Yala season (April-September). Maintain 2-3 inches of standing "
            "water during puddling. Use the traditional 'mudding' method to create an even seed bed. "
            "Apply basal fertilizer (Urea 50kg/ha, TSP 62.5kg/ha, MOP 50kg/ha) before final harrowing."
        ),
        "language": "en",
        "category": "rice_cultivation",
        "tags": ["rice", "land_preparation", "dry_zone", "fertilizer"],
    },
    {
        "source": "sri_lanka_rice_guide",
        "title": "වී වගාව - බිම් සැකසීම",
        "content": (
            "ශ්‍රී ලංකාවේ වියළි කලාපයේ (අනුරාධපුර, පොළොන්නරුව) වී වගාව සඳහා බිම් සැකසීම "
            "ප්‍රවේශමෙන් කළ යුතුය. මහ කන්නයේ (ඔක්තෝබර්-මාර්තු) හෝ යල කන්නයේ (අප්‍රේල්-සැප්තැම්බර්) "
            "වැපිරීමට සති 2-3 කට පෙර ගොයම් කිරීම ආරම්භ කරන්න. මඩ ගැසීමේදී අඟල් 2-3 ක ස්ථාවර "
            "ජල මට්ටමක් පවත්වා ගන්න. මූලික පොහොර (යූරියා 50kg/ha, TSP 62.5kg/ha, MOP 50kg/ha) "
            "අවසන් ඉරිතැලීමට පෙර යොදන්න."
        ),
        "language": "si",
        "category": "rice_cultivation",
        "tags": ["rice", "land_preparation", "dry_zone", "fertilizer"],
    },
    {
        "source": "pest_management_guide",
        "title": "Common Pest Management - Rice",
        "content": (
            "Key rice pests in the dry zone include Brown Plant Hopper (BPH), Stem Borer, and "
            "Leaf Folder. For BPH: avoid excessive nitrogen application, maintain field sanitation, "
            "and use resistant varieties (Bg 250, Bg 352). For Stem Borer: remove and destroy "
            "infected tillers, apply Carbofuran 3G at 30-40 days after transplanting if infestation "
            "exceeds economic threshold (5% dead hearts in vegetative stage). Integrated Pest "
            "Management (IPM) is recommended: combine cultural, biological, and minimal chemical methods."
        ),
        "language": "en",
        "category": "pest_management",
        "tags": ["rice", "pests", "bph", "stem_borer", "ipm"],
    },
    {
        "source": "vegetable_guide",
        "title": "Tomato Cultivation in Dry Zone",
        "content": (
            "Tomato cultivation in Anuradhapura district is best during Maha season. Select varieties "
            "like Thilina, KC-1, or Platinum. Start nursery beds in September, transplant seedlings "
            "at 4 weeks (15-20cm height). Spacing: 60cm x 45cm. Apply organic manure (10-15 t/ha) "
            "as basal. Stake plants at 3 weeks after transplanting. Regular irrigation every 3-4 days. "
            "Main diseases: bacterial wilt, late blight, leaf curl virus. Use disease-free seedlings "
            "and crop rotation to minimize risk."
        ),
        "language": "en",
        "category": "vegetable_cultivation",
        "tags": ["tomato", "dry_zone", "anuradhapura", "cultivation"],
    },
]


async def seed_knowledge():
    """Insert sample knowledge chunks (idempotent by source+title)."""
    async with async_session_factory() as session:
        inserted = 0
        skipped = 0

        for chunk_data in SAMPLE_CHUNKS:
            from sqlalchemy import select, and_

            result = await session.execute(
                select(KnowledgeChunk).where(
                    and_(
                        KnowledgeChunk.source == chunk_data["source"],
                        KnowledgeChunk.title == chunk_data["title"],
                    )
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                skipped += 1
                continue

            # Embedding generation placeholder — will use sentence-transformers in production
            chunk = KnowledgeChunk(**chunk_data, embedding=None)
            session.add(chunk)
            inserted += 1
            logger.info("chunk_inserted", title=chunk_data["title"][:50])

        await session.commit()
        logger.info("seed_knowledge_complete", inserted=inserted, skipped=skipped)


if __name__ == "__main__":
    asyncio.run(seed_knowledge())
