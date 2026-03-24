"""GoviHub Price Service — Market price history, trends, and alerts."""

from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.alerts.models import PriceHistory
from app.listings.models import CropTaxonomy

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Price alert thresholds
# ---------------------------------------------------------------------------

PRICE_DROP_THRESHOLD_PCT = 15.0   # % drop from 7-day average triggers alert
PRICE_SURGE_THRESHOLD_PCT = 20.0  # % increase from 7-day average triggers alert


# ---------------------------------------------------------------------------
# PriceService
# ---------------------------------------------------------------------------

class PriceService:
    """Service for market price queries, trend analysis, and alert evaluation."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # -----------------------------------------------------------------------
    # Fetch latest prices
    # -----------------------------------------------------------------------

    async def fetch_latest_prices(self, crop_id: UUID) -> list[dict]:
        """
        Return the most recent price entry per market for the given crop.
        """
        # Subquery: latest recorded_date per market
        latest_per_market = (
            select(
                PriceHistory.market_name,
                func.max(PriceHistory.recorded_date).label("latest_date"),
            )
            .where(PriceHistory.crop_id == crop_id)
            .group_by(PriceHistory.market_name)
            .subquery()
        )

        q = (
            select(PriceHistory)
            .join(
                latest_per_market,
                (PriceHistory.market_name == latest_per_market.c.market_name)
                & (PriceHistory.recorded_date == latest_per_market.c.latest_date),
            )
            .where(PriceHistory.crop_id == crop_id)
            .order_by(PriceHistory.market_name)
        )

        result = await self.db.execute(q)
        rows = result.scalars().all()

        return [
            {
                "market_name": r.market_name,
                "price_per_kg": float(r.price_per_kg),
                "unit": r.unit,
                "recorded_date": r.recorded_date.isoformat(),
                "source": r.source,
            }
            for r in rows
        ]

    # -----------------------------------------------------------------------
    # Get prices for crop over N days
    # -----------------------------------------------------------------------

    async def get_prices_for_crop(self, crop_id: UUID, days: int = 30) -> list[dict]:
        """
        Return all price records for the crop over the last `days` days,
        ordered by date ascending.
        """
        cutoff = date.today() - timedelta(days=days)

        q = (
            select(PriceHistory)
            .where(PriceHistory.crop_id == crop_id)
            .where(PriceHistory.recorded_date >= cutoff)
            .order_by(PriceHistory.recorded_date.asc(), PriceHistory.market_name)
        )

        result = await self.db.execute(q)
        rows = result.scalars().all()

        return [
            {
                "id": str(r.id),
                "crop_id": str(r.crop_id),
                "market_name": r.market_name,
                "price_per_kg": float(r.price_per_kg),
                "unit": r.unit,
                "recorded_date": r.recorded_date.isoformat(),
                "source": r.source,
            }
            for r in rows
        ]

    # -----------------------------------------------------------------------
    # Check price alerts
    # -----------------------------------------------------------------------

    async def check_price_alerts(self, crop_id: UUID) -> list[dict]:
        """
        Compare latest prices against 7-day average to detect significant
        price drops or surges. Returns list of alert dicts.
        """
        today = date.today()
        seven_days_ago = today - timedelta(days=7)

        # 7-day average per market
        avg_q = (
            select(
                PriceHistory.market_name,
                func.avg(PriceHistory.price_per_kg).label("avg_price"),
            )
            .where(PriceHistory.crop_id == crop_id)
            .where(PriceHistory.recorded_date >= seven_days_ago)
            .where(PriceHistory.recorded_date < today)
            .group_by(PriceHistory.market_name)
        )

        avg_result = await self.db.execute(avg_q)
        avg_rows = avg_result.all()
        avg_map = {row.market_name: float(row.avg_price) for row in avg_rows}

        if not avg_map:
            return []

        # Latest prices
        latest = await self.fetch_latest_prices(crop_id)

        # Fetch crop name for message
        crop_result = await self.db.execute(
            select(CropTaxonomy).where(CropTaxonomy.id == crop_id)
        )
        crop = crop_result.scalar_one_or_none()
        crop_name = crop.name_en if crop else str(crop_id)

        alerts = []
        for price_entry in latest:
            market = price_entry["market_name"]
            current = price_entry["price_per_kg"]
            avg = avg_map.get(market)

            if avg is None or avg == 0:
                continue

            change_pct = ((current - avg) / avg) * 100

            if change_pct <= -PRICE_DROP_THRESHOLD_PCT:
                alerts.append({
                    "type": "price_drop",
                    "severity": "high" if abs(change_pct) >= 30 else "moderate",
                    "crop_id": str(crop_id),
                    "crop_name": crop_name,
                    "market_name": market,
                    "current_price": current,
                    "average_price": round(avg, 2),
                    "change_pct": round(change_pct, 1),
                    "message": (
                        f"{crop_name} price dropped {abs(change_pct):.1f}% at {market}: "
                        f"LKR {current:.2f}/kg (avg: LKR {avg:.2f}/kg)"
                    ),
                    "recorded_date": price_entry["recorded_date"],
                })
            elif change_pct >= PRICE_SURGE_THRESHOLD_PCT:
                alerts.append({
                    "type": "price_surge",
                    "severity": "high" if change_pct >= 40 else "moderate",
                    "crop_id": str(crop_id),
                    "crop_name": crop_name,
                    "market_name": market,
                    "current_price": current,
                    "average_price": round(avg, 2),
                    "change_pct": round(change_pct, 1),
                    "message": (
                        f"{crop_name} price surged {change_pct:.1f}% at {market}: "
                        f"LKR {current:.2f}/kg (avg: LKR {avg:.2f}/kg)"
                    ),
                    "recorded_date": price_entry["recorded_date"],
                })

        return alerts

    # -----------------------------------------------------------------------
    # Get market prices for user (their crops)
    # -----------------------------------------------------------------------

    async def get_market_prices_for_user(self, db: AsyncSession, user_id: UUID) -> dict:
        """
        Return latest market prices for all active crops, enriched with
        7-day trend and any active alerts.
        """
        # Fetch all active crops
        crops_result = await db.execute(
            select(CropTaxonomy).where(CropTaxonomy.is_active.is_(True)).order_by(CropTaxonomy.name_en)
        )
        crops = crops_result.scalars().all()

        all_prices = []
        all_alerts = []

        for crop in crops:
            latest = await self.fetch_latest_prices(crop.id)
            alerts = await self.check_price_alerts(crop.id)

            all_prices.append({
                "crop_id": str(crop.id),
                "crop_name": crop.name_en,
                "crop_name_si": crop.name_si,
                "category": crop.category.value,
                "latest_prices": latest,
            })
            all_alerts.extend(alerts)

        return {
            "prices": all_prices,
            "alerts": all_alerts,
            "alert_count": len(all_alerts),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    # -----------------------------------------------------------------------
    # Trend analysis
    # -----------------------------------------------------------------------

    async def get_trend_data(self, crop_id: UUID, days: int = 30) -> dict:
        """
        Return aggregated daily average prices across all markets
        for trend visualisation over the last N days.
        """
        cutoff = date.today() - timedelta(days=days)

        q = (
            select(
                PriceHistory.recorded_date,
                PriceHistory.market_name,
                func.avg(PriceHistory.price_per_kg).label("avg_price"),
                func.min(PriceHistory.price_per_kg).label("min_price"),
                func.max(PriceHistory.price_per_kg).label("max_price"),
            )
            .where(PriceHistory.crop_id == crop_id)
            .where(PriceHistory.recorded_date >= cutoff)
            .group_by(PriceHistory.recorded_date, PriceHistory.market_name)
            .order_by(PriceHistory.recorded_date.asc(), PriceHistory.market_name)
        )

        result = await self.db.execute(q)
        rows = result.all()

        # Fetch crop name
        crop_result = await self.db.execute(
            select(CropTaxonomy).where(CropTaxonomy.id == crop_id)
        )
        crop = crop_result.scalar_one_or_none()

        return {
            "crop_id": str(crop_id),
            "crop_name": crop.name_en if crop else str(crop_id),
            "crop_name_si": crop.name_si if crop else None,
            "days": days,
            "data_points": [
                {
                    "date": row.recorded_date.isoformat(),
                    "market_name": row.market_name,
                    "avg_price": round(float(row.avg_price), 2),
                    "min_price": round(float(row.min_price), 2),
                    "max_price": round(float(row.max_price), 2),
                }
                for row in rows
            ],
        }
