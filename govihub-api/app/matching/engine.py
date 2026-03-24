"""GoviHub Matching Engine — Core algorithm for pairing harvest listings with demand postings."""

from __future__ import annotations

import math
from datetime import date, datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Scoring weights (must sum to 1.0)
# ---------------------------------------------------------------------------

WEIGHTS = {
    "distance": 0.35,
    "quantity": 0.25,
    "date_overlap": 0.25,
    "freshness": 0.15,
}

# Maximum search radius when a demand has no explicit radius_km set
DEFAULT_RADIUS_KM: int = 200

# Candidates returned per run
TOP_N: int = 10

# Score threshold for creating Match records
SCORE_THRESHOLD: float = 0.30

# Max distance used for normalisation (beyond this → score 0)
MAX_DISTANCE_KM: float = 300.0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class MatchingEngine:
    """Stateless matching engine that operates on raw SQL for PostGIS support."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Entry points
    # ------------------------------------------------------------------

    async def find_matches_for_demand(
        self,
        demand_id: UUID,
    ) -> List[dict]:
        """Find the best harvest listings for a given demand posting.

        Returns a list of candidate dicts (harvest_id, score, score_breakdown,
        distance_km) sorted by descending score, capped at TOP_N.
        """
        from app.listings.models import DemandPosting

        demand = await self.db.get(DemandPosting, demand_id)
        if demand is None:
            logger.warning("find_matches_for_demand: demand not found", demand_id=str(demand_id))
            return []

        radius_km = demand.radius_km or DEFAULT_RADIUS_KM
        radius_m = radius_km * 1000  # ST_DWithin expects metres for Geography

        sql = text("""
            SELECT
                hl.id                                                  AS harvest_id,
                hl.quantity_kg                                         AS harvest_qty,
                hl.available_from                                      AS avail_from,
                hl.available_until                                     AS avail_until,
                hl.created_at                                          AS harvest_created,
                CASE
                    WHEN hl.location IS NOT NULL AND dp.location IS NOT NULL
                        THEN ST_Distance(hl.location::geography, dp.location::geography) / 1000.0
                    ELSE NULL
                END                                                    AS distance_km
            FROM harvest_listings hl
            JOIN demand_postings dp ON dp.id = :demand_id
            WHERE hl.crop_id   = dp.crop_id
              AND hl.status    = 'ready'
              AND dp.status    = 'open'
              AND (
                    hl.location IS NULL
                    OR dp.location IS NULL
                    OR ST_DWithin(hl.location::geography, dp.location::geography, :radius_m)
              )
              AND (
                    hl.available_until IS NULL
                    OR dp.needed_by    IS NULL
                    OR hl.available_until >= CURRENT_DATE
              )
        """)

        result = await self.db.execute(
            sql,
            {"demand_id": str(demand_id), "radius_m": radius_m},
        )
        rows = result.mappings().all()

        candidates = []
        for row in rows:
            dist_km = float(row["distance_km"]) if row["distance_km"] is not None else None
            score, breakdown = self._compute_score(
                harvest_qty=float(row["harvest_qty"]),
                demand_qty=float(demand.quantity_kg),
                harvest_avail_from=row["avail_from"],
                harvest_avail_until=row["avail_until"],
                demand_needed_by=demand.needed_by,
                harvest_created=row["harvest_created"],
                distance_km=dist_km,
            )
            candidates.append(
                {
                    "harvest_id": row["harvest_id"],
                    "demand_id": demand_id,
                    "score": score,
                    "score_breakdown": breakdown,
                    "distance_km": dist_km,
                }
            )

        candidates.sort(key=lambda c: c["score"], reverse=True)
        return candidates[:TOP_N]

    async def find_matches_for_harvest(
        self,
        harvest_id: UUID,
    ) -> List[dict]:
        """Find the best demand postings for a given harvest listing.

        Mirror of find_matches_for_demand.
        """
        from app.listings.models import HarvestListing

        harvest = await self.db.get(HarvestListing, harvest_id)
        if harvest is None:
            logger.warning("find_matches_for_harvest: harvest not found", harvest_id=str(harvest_id))
            return []

        sql = text("""
            SELECT
                dp.id                                                  AS demand_id,
                dp.quantity_kg                                         AS demand_qty,
                dp.needed_by                                           AS needed_by,
                dp.radius_km                                           AS radius_km,
                dp.created_at                                          AS demand_created,
                CASE
                    WHEN hl.location IS NOT NULL AND dp.location IS NOT NULL
                        THEN ST_Distance(hl.location::geography, dp.location::geography) / 1000.0
                    ELSE NULL
                END                                                    AS distance_km
            FROM demand_postings dp
            JOIN harvest_listings hl ON hl.id = :harvest_id
            WHERE dp.crop_id   = hl.crop_id
              AND dp.status    = 'open'
              AND hl.status    = 'ready'
              AND (
                    hl.location IS NULL
                    OR dp.location IS NULL
                    OR ST_DWithin(hl.location::geography, dp.location::geography,
                                  (COALESCE(dp.radius_km, :default_radius_km) * 1000))
              )
              AND (
                    hl.available_until IS NULL
                    OR dp.needed_by    IS NULL
                    OR hl.available_until >= CURRENT_DATE
              )
        """)

        result = await self.db.execute(
            sql,
            {"harvest_id": str(harvest_id), "default_radius_km": DEFAULT_RADIUS_KM},
        )
        rows = result.mappings().all()

        candidates = []
        for row in rows:
            dist_km = float(row["distance_km"]) if row["distance_km"] is not None else None
            score, breakdown = self._compute_score(
                harvest_qty=float(harvest.quantity_kg),
                demand_qty=float(row["demand_qty"]),
                harvest_avail_from=harvest.available_from,
                harvest_avail_until=harvest.available_until,
                demand_needed_by=row["needed_by"],
                harvest_created=harvest.created_at,
                distance_km=dist_km,
            )
            candidates.append(
                {
                    "harvest_id": harvest_id,
                    "demand_id": row["demand_id"],
                    "score": score,
                    "score_breakdown": breakdown,
                    "distance_km": dist_km,
                }
            )

        candidates.sort(key=lambda c: c["score"], reverse=True)
        return candidates[:TOP_N]

    async def suggest_farmer_cluster(
        self,
        demand_id: UUID,
    ) -> List[dict]:
        """Return groups of nearby farmers whose combined supply can satisfy a demand.

        Each group entry contains: farmer_id, total_qty_kg, harvest_ids, centroid_distance_km.
        Only groups whose combined quantity >= demand.quantity_kg are returned.
        """
        from app.listings.models import DemandPosting

        demand = await self.db.get(DemandPosting, demand_id)
        if demand is None:
            return []

        radius_km = demand.radius_km or DEFAULT_RADIUS_KM
        radius_m = radius_km * 1000

        sql = text("""
            SELECT
                hl.farmer_id,
                ARRAY_AGG(hl.id::text)                                     AS harvest_ids,
                SUM(hl.quantity_kg)                                        AS total_qty,
                CASE
                    WHEN dp.location IS NOT NULL
                         AND MIN(hl.location::text) IS NOT NULL
                        THEN AVG(ST_Distance(hl.location::geography, dp.location::geography)) / 1000.0
                    ELSE NULL
                END                                                        AS avg_distance_km
            FROM harvest_listings hl
            JOIN demand_postings dp ON dp.id = :demand_id
            WHERE hl.crop_id   = dp.crop_id
              AND hl.status    = 'ready'
              AND dp.status    = 'open'
              AND (
                    hl.location IS NULL
                    OR dp.location IS NULL
                    OR ST_DWithin(hl.location::geography, dp.location::geography, :radius_m)
              )
            GROUP BY hl.farmer_id
            HAVING SUM(hl.quantity_kg) >= dp.quantity_kg
            ORDER BY avg_distance_km ASC NULLS LAST
            LIMIT 10
        """)

        result = await self.db.execute(sql, {"demand_id": str(demand_id), "radius_m": radius_m})
        rows = result.mappings().all()

        clusters = []
        for row in rows:
            clusters.append(
                {
                    "farmer_id": row["farmer_id"],
                    "harvest_ids": row["harvest_ids"],
                    "total_qty_kg": float(row["total_qty"]),
                    "centroid_distance_km": float(row["avg_distance_km"]) if row["avg_distance_km"] else None,
                }
            )
        return clusters

    # ------------------------------------------------------------------
    # Scoring
    # ------------------------------------------------------------------

    @staticmethod
    def compute_match_score(
        harvest_qty: float,
        demand_qty: float,
        harvest_avail_from: Optional[date],
        harvest_avail_until: Optional[date],
        demand_needed_by: Optional[date],
        harvest_created: datetime,
        distance_km: Optional[float],
    ) -> Tuple[float, dict]:
        """Public static wrapper — delegates to _compute_score."""
        return MatchingEngine._compute_score(
            harvest_qty=harvest_qty,
            demand_qty=demand_qty,
            harvest_avail_from=harvest_avail_from,
            harvest_avail_until=harvest_avail_until,
            demand_needed_by=demand_needed_by,
            harvest_created=harvest_created,
            distance_km=distance_km,
        )

    @staticmethod
    def _compute_score(
        harvest_qty: float,
        demand_qty: float,
        harvest_avail_from: Optional[date],
        harvest_avail_until: Optional[date],
        demand_needed_by: Optional[date],
        harvest_created: datetime,
        distance_km: Optional[float],
    ) -> Tuple[float, dict]:
        """Compute a weighted [0, 1] score for a harvest–demand pair.

        Returns (total_score, breakdown_dict).
        """
        # 1. Distance score
        if distance_km is None:
            distance_score = 0.5  # neutral when no geo data
        else:
            distance_score = max(0.0, 1.0 - (distance_km / MAX_DISTANCE_KM))

        # 2. Quantity score — penalise large mismatch
        if demand_qty > 0 and harvest_qty > 0:
            ratio = min(harvest_qty, demand_qty) / max(harvest_qty, demand_qty)
            quantity_score = ratio
        else:
            quantity_score = 0.0

        # 3. Date overlap score
        today = date.today()
        if demand_needed_by is None or harvest_avail_until is None:
            date_overlap_score = 0.7  # neutral when dates unknown
        else:
            avail_from = harvest_avail_from or today
            avail_until = harvest_avail_until
            needed_by = demand_needed_by

            # Overlap exists when avail_from <= needed_by AND avail_until >= today
            if avail_from <= needed_by and avail_until >= today:
                # How much of the demand window is covered
                overlap_days = (min(avail_until, needed_by) - max(avail_from, today)).days + 1
                demand_window = (needed_by - today).days + 1
                if demand_window <= 0:
                    date_overlap_score = 0.0
                else:
                    date_overlap_score = min(1.0, overlap_days / max(demand_window, 1))
            else:
                date_overlap_score = 0.0

        # 4. Freshness score (decay over 30 days)
        now = datetime.now(timezone.utc)
        if harvest_created.tzinfo is None:
            harvest_created = harvest_created.replace(tzinfo=timezone.utc)
        age_days = (now - harvest_created).days
        freshness_score = math.exp(-age_days / 30.0)

        # Weighted total
        total = (
            WEIGHTS["distance"] * distance_score
            + WEIGHTS["quantity"] * quantity_score
            + WEIGHTS["date_overlap"] * date_overlap_score
            + WEIGHTS["freshness"] * freshness_score
        )
        total = round(min(1.0, max(0.0, total)), 4)

        breakdown = {
            "distance_score": round(distance_score, 4),
            "quantity_score": round(quantity_score, 4),
            "date_overlap_score": round(date_overlap_score, 4),
            "freshness_score": round(freshness_score, 4),
            "total": total,
            "distance_km": round(distance_km, 2) if distance_km is not None else None,
        }

        return total, breakdown


# ---------------------------------------------------------------------------
# Module-level convenience functions (used by tasks.py)
# ---------------------------------------------------------------------------

async def find_matches_for_demand(db: AsyncSession, demand_id: UUID) -> List[dict]:
    return await MatchingEngine(db).find_matches_for_demand(demand_id)


async def find_matches_for_harvest(db: AsyncSession, harvest_id: UUID) -> List[dict]:
    return await MatchingEngine(db).find_matches_for_harvest(harvest_id)
