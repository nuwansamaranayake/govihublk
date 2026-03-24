"""GoviHub Database Seeder — Runs all seed scripts."""

import asyncio
import sys
from pathlib import Path

import structlog

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.seed_crops import seed_crops
from scripts.seed_knowledge import seed_knowledge

logger = structlog.get_logger()


async def main():
    """Run all database seeds."""
    logger.info("seed_start")
    await seed_crops()
    await seed_knowledge()
    logger.info("seed_complete")


if __name__ == "__main__":
    asyncio.run(main())
