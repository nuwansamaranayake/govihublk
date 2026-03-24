#!/usr/bin/env python3
"""GoviHub APScheduler — Background task scheduler.

Scheduled jobs:
  - Weather alerts:   every hour
  - Price updates:    daily at 06:00 IST
  - Database backup:  daily at 02:00 IST
  - Expire listings:  daily at 03:00 IST
  - Clean notifications: weekly on Sunday at 04:00 IST

Run as a standalone process:
    python scripts/scheduler.py

Or as a Docker service:
    docker compose up scheduler
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys
from datetime import datetime, timezone

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

# IST = UTC+5:30 → to run at 06:00 IST use UTC 00:30
IST_OFFSET_HOURS = 5
IST_OFFSET_MINUTES = 30

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.dev.ConsoleRenderer(),
    ]
)

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Job implementations
# ---------------------------------------------------------------------------

async def job_update_weather_alerts() -> None:
    """Fetch weather data and create alerts for farmers in affected districts."""
    logger.info("scheduler.weather_alerts.start")
    try:
        from app.database import async_session_factory
        from app.alerts.service import AlertService

        async with async_session_factory() as db:
            service = AlertService(db)
            await service.refresh_weather_alerts()
            await db.commit()

        logger.info("scheduler.weather_alerts.done")
    except Exception as exc:
        logger.error("scheduler.weather_alerts.error", error=str(exc))


async def job_update_market_prices() -> None:
    """Fetch and cache market prices from DoA API."""
    logger.info("scheduler.market_prices.start")
    try:
        from app.database import async_session_factory
        from app.alerts.service import AlertService

        async with async_session_factory() as db:
            service = AlertService(db)
            await service.refresh_market_prices()
            await db.commit()

        logger.info("scheduler.market_prices.done")
    except Exception as exc:
        logger.error("scheduler.market_prices.error", error=str(exc))


async def job_backup_database() -> None:
    """Run PostgreSQL backup and upload to R2."""
    logger.info("scheduler.backup.start")
    try:
        import subprocess

        script_dir = os.path.dirname(os.path.abspath(__file__))
        backup_script = os.path.join(script_dir, "backup.sh")

        result = subprocess.run(
            ["/bin/bash", backup_script],
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout
        )

        if result.returncode == 0:
            logger.info("scheduler.backup.done")
        else:
            logger.error(
                "scheduler.backup.failed",
                returncode=result.returncode,
                stderr=result.stderr[-500:],
            )
    except subprocess.TimeoutExpired:
        logger.error("scheduler.backup.timeout")
    except Exception as exc:
        logger.error("scheduler.backup.error", error=str(exc))


async def job_expire_stale_listings() -> None:
    """Mark harvest listings and demand postings as expired when past their dates."""
    logger.info("scheduler.expire_listings.start")
    try:
        from datetime import date

        from sqlalchemy import update

        from app.database import async_session_factory
        from app.listings.models import DemandPosting, DemandStatus, HarvestListing, ListingStatus

        today = date.today()

        async with async_session_factory() as db:
            # Expire harvest listings whose available_until has passed
            harvest_result = await db.execute(
                update(HarvestListing)
                .where(
                    HarvestListing.available_until < today,
                    HarvestListing.status == ListingStatus.active,
                )
                .values(status=ListingStatus.expired)
                .returning(HarvestListing.id)
            )
            expired_harvests = harvest_result.rowcount

            # Expire demand postings whose needed_by date has passed
            demand_result = await db.execute(
                update(DemandPosting)
                .where(
                    DemandPosting.needed_by < today,
                    DemandPosting.status == DemandStatus.active,
                )
                .values(status=DemandStatus.expired)
                .returning(DemandPosting.id)
            )
            expired_demands = demand_result.rowcount

            await db.commit()

        logger.info(
            "scheduler.expire_listings.done",
            expired_harvests=expired_harvests,
            expired_demands=expired_demands,
        )
    except Exception as exc:
        logger.error("scheduler.expire_listings.error", error=str(exc))


async def job_cleanup_old_notifications() -> None:
    """Delete read notifications older than 90 days."""
    logger.info("scheduler.cleanup_notifications.start")
    try:
        from datetime import timedelta

        from sqlalchemy import delete

        from app.database import async_session_factory
        from app.notifications.models import Notification

        cutoff = datetime.now(timezone.utc) - timedelta(days=90)

        async with async_session_factory() as db:
            result = await db.execute(
                delete(Notification).where(
                    Notification.is_read == True,
                    Notification.created_at < cutoff,
                )
            )
            deleted_count = result.rowcount
            await db.commit()

        logger.info("scheduler.cleanup_notifications.done", deleted=deleted_count)
    except Exception as exc:
        logger.error("scheduler.cleanup_notifications.error", error=str(exc))


async def job_expire_stale_matches() -> None:
    """Mark proposed matches as expired if neither party has accepted within 7 days."""
    logger.info("scheduler.expire_matches.start")
    try:
        from datetime import timedelta

        from sqlalchemy import update

        from app.database import async_session_factory
        from app.matching.models import Match, MatchStatus

        cutoff = datetime.now(timezone.utc) - timedelta(days=7)

        async with async_session_factory() as db:
            result = await db.execute(
                update(Match)
                .where(
                    Match.status == MatchStatus.proposed,
                    Match.created_at < cutoff,
                )
                .values(status=MatchStatus.expired)
            )
            expired_count = result.rowcount
            await db.commit()

        logger.info("scheduler.expire_matches.done", expired=expired_count)
    except Exception as exc:
        logger.error("scheduler.expire_matches.error", error=str(exc))


# ---------------------------------------------------------------------------
# Scheduler setup
# ---------------------------------------------------------------------------

def create_scheduler() -> AsyncIOScheduler:
    """Build and configure the APScheduler instance."""
    scheduler = AsyncIOScheduler(timezone="Asia/Colombo")

    # Weather alerts — every hour at :05 past the hour
    scheduler.add_job(
        job_update_weather_alerts,
        trigger=CronTrigger(minute=5),
        id="weather_alerts",
        name="Weather Alerts Refresh",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,
    )

    # Market prices — daily at 06:00 IST (00:30 UTC)
    scheduler.add_job(
        job_update_market_prices,
        trigger=CronTrigger(hour=0, minute=30, timezone="UTC"),
        id="market_prices",
        name="Market Prices Update",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )

    # Database backup — daily at 02:00 IST (20:30 UTC previous day)
    scheduler.add_job(
        job_backup_database,
        trigger=CronTrigger(hour=20, minute=30, timezone="UTC"),
        id="database_backup",
        name="Database Backup",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )

    # Expire stale listings — daily at 03:00 IST (21:30 UTC previous day)
    scheduler.add_job(
        job_expire_stale_listings,
        trigger=CronTrigger(hour=21, minute=30, timezone="UTC"),
        id="expire_listings",
        name="Expire Stale Listings",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )

    # Expire stale matches — daily at 03:30 IST (22:00 UTC previous day)
    scheduler.add_job(
        job_expire_stale_matches,
        trigger=CronTrigger(hour=22, minute=0, timezone="UTC"),
        id="expire_matches",
        name="Expire Stale Matches",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )

    # Clean old notifications — weekly on Sunday at 04:00 IST (22:30 UTC Saturday)
    scheduler.add_job(
        job_cleanup_old_notifications,
        trigger=CronTrigger(day_of_week="sat", hour=22, minute=30, timezone="UTC"),
        id="cleanup_notifications",
        name="Cleanup Old Notifications",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )

    return scheduler


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def main() -> None:
    """Start the scheduler and run until shutdown signal."""
    logger.info("govihub_scheduler.starting", version="1.0.0")

    scheduler = create_scheduler()
    scheduler.start()

    logger.info(
        "govihub_scheduler.started",
        job_count=len(scheduler.get_jobs()),
        jobs=[j.name for j in scheduler.get_jobs()],
    )

    # Handle SIGTERM / SIGINT gracefully
    loop = asyncio.get_event_loop()
    shutdown_event = asyncio.Event()

    def _on_signal(sig):
        logger.info("govihub_scheduler.shutting_down", signal=sig.name)
        scheduler.shutdown(wait=True)
        shutdown_event.set()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _on_signal, sig)

    await shutdown_event.wait()
    logger.info("govihub_scheduler.stopped")


if __name__ == "__main__":
    asyncio.run(main())
