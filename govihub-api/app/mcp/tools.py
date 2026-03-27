"""GoviHub MCP Tools — Definitions and async handler functions for all 16 MCP tools."""

from __future__ import annotations

import asyncio
from typing import Any

import structlog
from sqlalchemy import func, select, text

from app.database import async_session_factory

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Tool Definitions (JSON Schema per MCP spec)
# ---------------------------------------------------------------------------

TOOL_DEFINITIONS: list[dict] = [
    {
        "name": "search_farmers",
        "description": (
            "Search for registered farmers on GoviHub. Filter by district, province, crop type, "
            "farm size, and irrigation type. Returns farmer profiles with contact-safe summaries."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "district": {
                    "type": "string",
                    "description": "Sri Lanka district name (e.g. Kandy, Colombo, Galle)",
                },
                "province": {
                    "type": "string",
                    "description": "Sri Lanka province name",
                },
                "crop": {
                    "type": "string",
                    "description": "Crop name or code to filter farmers who grow this crop",
                },
                "irrigation_type": {
                    "type": "string",
                    "description": "Irrigation method (e.g. drip, flood, rain-fed)",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of results to return (default 20, max 100)",
                    "default": 20,
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "search_listings",
        "description": (
            "Search harvest supply listings and buyer demand postings. Filter by crop, status, "
            "district, price range, and listing type (harvest/demand)."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "listing_type": {
                    "type": "string",
                    "enum": ["harvest", "demand", "both"],
                    "description": "Type of listing to search",
                    "default": "both",
                },
                "crop": {
                    "type": "string",
                    "description": "Crop name or code",
                },
                "status": {
                    "type": "string",
                    "description": "Listing status filter (harvest: planned, ready, matched, fulfilled; demand: open, reviewing, confirmed, fulfilled)",
                },
                "district": {
                    "type": "string",
                    "description": "Farmer/buyer district",
                },
                "min_quantity_kg": {
                    "type": "number",
                    "description": "Minimum quantity in kg",
                },
                "max_price_per_kg": {
                    "type": "number",
                    "description": "Maximum price per kg in LKR",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum results (default 20, max 100)",
                    "default": 20,
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "get_match_analytics",
        "description": (
            "Retrieve aggregated analytics about crop matches: total matches by status, "
            "average match score, top matched crops, and conversion rates."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "Number of recent days to analyse (default 30)",
                    "default": 30,
                },
                "crop": {
                    "type": "string",
                    "description": "Filter analytics to a specific crop",
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "get_price_trends",
        "description": (
            "Return average price-per-kg trends for crops over time, derived from "
            "harvest listings. Useful for market price intelligence."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "crop": {
                    "type": "string",
                    "description": "Crop name or code (required)",
                },
                "days": {
                    "type": "integer",
                    "description": "Number of days of price history (default 90)",
                    "default": 90,
                },
                "district": {
                    "type": "string",
                    "description": "Optionally restrict to a specific district",
                },
            },
            "required": ["crop"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_diagnosis_insights",
        "description": (
            "Summarise crop disease diagnosis results on the platform: most common diseases, "
            "accuracy metrics, user feedback distribution, and per-crop breakdown."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "Number of recent days to include (default 30)",
                    "default": 30,
                },
                "crop": {
                    "type": "string",
                    "description": "Filter to a specific crop",
                },
                "limit": {
                    "type": "integer",
                    "description": "Top N diseases to return (default 10)",
                    "default": 10,
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "get_weather_summary",
        "description": (
            "Retrieve the latest weather advisory data cached on the platform for "
            "a given district or province in Sri Lanka."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "district": {
                    "type": "string",
                    "description": "Sri Lanka district (e.g. Kandy, Jaffna)",
                },
                "province": {
                    "type": "string",
                    "description": "Sri Lanka province (e.g. Central, Northern)",
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "get_platform_stats",
        "description": (
            "High-level GoviHub platform statistics: total users by role, active listings, "
            "matches this month, diagnoses this week, and advisory questions answered."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "include_growth": {
                    "type": "boolean",
                    "description": "Whether to include month-over-month growth percentages",
                    "default": False,
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "search_knowledge_base",
        "description": (
            "Full-text search across the GoviHub agricultural knowledge base chunks. "
            "Returns relevant articles, advisories, and tips for farmers."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query text (English, Sinhala, or Tamil)",
                },
                "category": {
                    "type": "string",
                    "description": "Knowledge category filter (e.g. pest_control, fertilization)",
                },
                "language": {
                    "type": "string",
                    "enum": ["en", "si", "ta"],
                    "description": "Filter by content language",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results to return (default 10)",
                    "default": 10,
                },
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_farmer_profile",
        "description": (
            "Retrieve the detailed profile of a specific farmer by their user ID, "
            "including farm details, active listings count, and match history summary."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_id": {
                    "type": "string",
                    "format": "uuid",
                    "description": "UUID of the farmer user",
                },
            },
            "required": ["user_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_supply_chain_overview",
        "description": (
            "Overview of the agricultural supply chain on GoviHub: active supply listings "
            "by category, top suppliers by district, and stock availability summary."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "Supply category filter (seeds, fertilizer, pesticide, equipment, tools, irrigation, other)",
                },
                "district": {
                    "type": "string",
                    "description": "Filter suppliers by district",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max suppliers to return (default 20)",
                    "default": 20,
                },
            },
            "additionalProperties": False,
        },
    },
    # ------------------------------------------------------------------
    # Admin / monitoring tools (6 new)
    # ------------------------------------------------------------------
    {
        "name": "govihub_get_registrations",
        "description": (
            "Get user registrations with role breakdown. Filter by number of recent days "
            "and optionally by role (farmer, buyer, supplier, admin). Returns individual "
            "registrations and a summary with totals per role."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "Number of recent days to look back (default 7)",
                    "default": 7,
                },
                "role": {
                    "type": "string",
                    "enum": ["farmer", "buyer", "supplier", "admin"],
                    "description": "Filter registrations to a specific role",
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "govihub_get_user_activity",
        "description": (
            "User engagement metrics across the platform. Tracks listing creation, demand "
            "posting, match activity, diagnosis uploads, feedback submissions, and logins. "
            "Returns activity counts by type, most active users, and daily trends."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "Number of recent days to analyse (default 7)",
                    "default": 7,
                },
                "activity_type": {
                    "type": "string",
                    "enum": [
                        "listing_created",
                        "demand_created",
                        "match_activity",
                        "diagnosis_uploaded",
                        "feedback_submitted",
                        "login",
                    ],
                    "description": "Filter to a specific activity type",
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "govihub_get_feedback",
        "description": (
            "Get beta feedback and feature requests. Filter by days, category "
            "(bug, feature_request, general, wishlist), and language (si, en). "
            "Returns feedback items with user info and summary statistics."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "Number of recent days to look back (default 30)",
                    "default": 30,
                },
                "category": {
                    "type": "string",
                    "enum": ["bug", "feature_request", "general", "wishlist"],
                    "description": "Filter by feedback category",
                },
                "language": {
                    "type": "string",
                    "enum": ["si", "en"],
                    "description": "Filter by feedback language",
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "govihub_get_platform_stats",
        "description": (
            "Comprehensive platform statistics: users by role, listings by status, "
            "matches by status, diagnoses count, and feedback count. "
            "No input parameters required."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
    {
        "name": "govihub_get_listings_summary",
        "description": (
            "Harvest and demand listings summary grouped by crop. Shows quantities "
            "and statuses. Filter by listing status, district, and time period."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "description": "Filter by listing status",
                },
                "district": {
                    "type": "string",
                    "description": "Filter by district",
                },
                "days": {
                    "type": "integer",
                    "description": "Number of recent days to include (default 30)",
                    "default": 30,
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "govihub_get_match_performance",
        "description": (
            "Matching engine funnel metrics: counts of matches by status "
            "(proposed -> accepted -> confirmed -> fulfilled), conversion rates "
            "between stages, average match scores, and dispute rate."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "Number of recent days to analyse (default 30)",
                    "default": 30,
                },
            },
            "additionalProperties": False,
        },
    },
]


# ---------------------------------------------------------------------------
# Handler Implementations
# ---------------------------------------------------------------------------

async def _handle_search_farmers(params: dict) -> dict:
    """Search farmers with optional filters."""
    district = params.get("district")
    province = params.get("province")
    crop = params.get("crop")
    irrigation_type = params.get("irrigation_type")
    limit = min(int(params.get("limit", 20)), 100)

    async with async_session_factory() as session:
        # Build query dynamically — asyncpg cannot infer type for NULL params
        sf_conditions = ["u.role = 'farmer'", "u.is_active = TRUE"]
        sf_params: dict[str, Any] = {"limit": limit}
        if district:
            sf_conditions.append("u.district ILIKE :district")
            sf_params["district"] = f"%{district}%"
        if province:
            sf_conditions.append("u.province ILIKE :province")
            sf_params["province"] = f"%{province}%"
        if irrigation_type:
            sf_conditions.append("fp.irrigation_type ILIKE :irrigation_type")
            sf_params["irrigation_type"] = f"%{irrigation_type}%"

        stmt = text(f"""
            SELECT
                u.id,
                u.name,
                u.district,
                u.province,
                u.is_verified,
                u.created_at,
                fp.farm_size_acres,
                fp.primary_crops,
                fp.irrigation_type,
                fp.cooperative
            FROM users u
            LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
            WHERE {" AND ".join(sf_conditions)}
            ORDER BY u.created_at DESC
            LIMIT :limit
        """)

        result = await session.execute(stmt, sf_params)
        rows = result.mappings().all()

        farmers = []
        for row in rows:
            primary_crops = row["primary_crops"] or []
            # Crop name filter (client-side after fetch since it's JSONB)
            if crop and not any(
                crop.lower() in str(c).lower() for c in primary_crops
            ):
                continue
            farmers.append({
                "id": str(row["id"]),
                "name": row["name"],
                "district": row["district"],
                "province": row["province"],
                "is_verified": row["is_verified"],
                "farm_size_acres": float(row["farm_size_acres"]) if row["farm_size_acres"] else None,
                "primary_crops": primary_crops,
                "irrigation_type": row["irrigation_type"],
                "cooperative": row["cooperative"],
                "member_since": row["created_at"].isoformat() if row["created_at"] else None,
            })

        return {
            "tool": "search_farmers",
            "count": len(farmers),
            "farmers": farmers,
            "filters_applied": {
                "district": district,
                "province": province,
                "crop": crop,
                "irrigation_type": irrigation_type,
            },
        }


async def _handle_search_listings(params: dict) -> dict:
    """Search harvest listings and demand postings."""
    listing_type = params.get("listing_type", "both")
    crop = params.get("crop")
    status = params.get("status")
    district = params.get("district")
    min_qty = params.get("min_quantity_kg")
    max_price = params.get("max_price_per_kg")
    limit = min(int(params.get("limit", 20)), 100)

    results: dict[str, Any] = {"tool": "search_listings"}

    async with async_session_factory() as session:
        if listing_type in ("harvest", "both"):
            h_conds: list[str] = []
            h_params: dict[str, Any] = {"limit": limit}
            if crop:
                h_conds.append("(ct.name_en ILIKE :crop OR ct.code ILIKE :crop)")
                h_params["crop"] = f"%{crop}%"
            if status:
                h_conds.append("hl.status::text = :status")
                h_params["status"] = status
            if district:
                h_conds.append("u.district ILIKE :district")
                h_params["district"] = f"%{district}%"
            if min_qty is not None:
                h_conds.append("hl.quantity_kg >= :min_qty")
                h_params["min_qty"] = min_qty
            if max_price is not None:
                h_conds.append("hl.price_per_kg <= :max_price")
                h_params["max_price"] = max_price
            h_where = ("WHERE " + " AND ".join(h_conds)) if h_conds else ""

            stmt = text(f"""
                SELECT
                    hl.id,
                    'harvest' AS type,
                    ct.name_en AS crop_name,
                    ct.code AS crop_code,
                    hl.quantity_kg,
                    hl.price_per_kg,
                    hl.quality_grade,
                    hl.status,
                    hl.harvest_date,
                    hl.is_organic,
                    hl.delivery_available,
                    u.district,
                    hl.created_at
                FROM harvest_listings hl
                JOIN crop_taxonomy ct ON ct.id = hl.crop_id
                JOIN users u ON u.id = hl.farmer_id
                {h_where}
                ORDER BY hl.created_at DESC
                LIMIT :limit
            """)
            r = await session.execute(stmt, h_params)
            harvest_rows = r.mappings().all()
            results["harvest_listings"] = [
                {
                    "id": str(row["id"]),
                    "type": "harvest",
                    "crop": row["crop_name"],
                    "crop_code": row["crop_code"],
                    "quantity_kg": float(row["quantity_kg"]) if row["quantity_kg"] else None,
                    "price_per_kg": float(row["price_per_kg"]) if row["price_per_kg"] else None,
                    "quality_grade": row["quality_grade"],
                    "status": row["status"],
                    "harvest_date": row["harvest_date"].isoformat() if row["harvest_date"] else None,
                    "is_organic": row["is_organic"],
                    "delivery_available": row["delivery_available"],
                    "district": row["district"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                }
                for row in harvest_rows
            ]

        if listing_type in ("demand", "both"):
            d_conds: list[str] = []
            d_params: dict[str, Any] = {"limit": limit}
            if crop:
                d_conds.append("(ct.name_en ILIKE :crop OR ct.code ILIKE :crop)")
                d_params["crop"] = f"%{crop}%"
            if status:
                d_conds.append("dp.status::text = :status")
                d_params["status"] = status
            if district:
                d_conds.append("u.district ILIKE :district")
                d_params["district"] = f"%{district}%"
            if min_qty is not None:
                d_conds.append("dp.quantity_kg >= :min_qty")
                d_params["min_qty"] = min_qty
            if max_price is not None:
                d_conds.append("dp.max_price_per_kg <= :max_price")
                d_params["max_price"] = max_price
            d_where = ("WHERE " + " AND ".join(d_conds)) if d_conds else ""

            stmt = text(f"""
                SELECT
                    dp.id,
                    'demand' AS type,
                    ct.name_en AS crop_name,
                    ct.code AS crop_code,
                    dp.quantity_kg,
                    dp.max_price_per_kg,
                    dp.quality_grade,
                    dp.status,
                    dp.needed_by,
                    dp.is_recurring,
                    u.district,
                    dp.created_at
                FROM demand_postings dp
                JOIN crop_taxonomy ct ON ct.id = dp.crop_id
                JOIN users u ON u.id = dp.buyer_id
                {d_where}
                ORDER BY dp.created_at DESC
                LIMIT :limit
            """)
            r = await session.execute(stmt, d_params)
            demand_rows = r.mappings().all()
            results["demand_postings"] = [
                {
                    "id": str(row["id"]),
                    "type": "demand",
                    "crop": row["crop_name"],
                    "crop_code": row["crop_code"],
                    "quantity_kg": float(row["quantity_kg"]) if row["quantity_kg"] else None,
                    "max_price_per_kg": float(row["max_price_per_kg"]) if row["max_price_per_kg"] else None,
                    "quality_grade": row["quality_grade"],
                    "status": row["status"],
                    "needed_by": row["needed_by"].isoformat() if row["needed_by"] else None,
                    "is_recurring": row["is_recurring"],
                    "district": row["district"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                }
                for row in demand_rows
            ]

        results["filters_applied"] = {
            "listing_type": listing_type,
            "crop": crop,
            "status": status,
            "district": district,
            "min_quantity_kg": min_qty,
            "max_price_per_kg": max_price,
        }

    return results


async def _handle_get_match_analytics(params: dict) -> dict:
    """Return aggregated match analytics."""
    days = int(params.get("days", 30))
    crop = params.get("crop")

    async with async_session_factory() as session:
        # Build crop filter dynamically — asyncpg cannot infer type for NULL params
        ma_crop_cond = "AND (ct.name_en ILIKE :crop OR ct.code ILIKE :crop)" if crop else ""
        ma_crop_params: dict[str, Any] = {"crop": f"%{crop}%"} if crop else {}

        status_stmt = text(f"""
            SELECT m.status, COUNT(*) AS count, AVG(m.score) AS avg_score
            FROM matches m
            JOIN harvest_listings hl ON hl.id = m.harvest_id
            JOIN crop_taxonomy ct ON ct.id = hl.crop_id
            WHERE m.created_at >= NOW() - INTERVAL '{days} days'
              {ma_crop_cond}
            GROUP BY m.status
            ORDER BY count DESC
        """)
        r = await session.execute(status_stmt, ma_crop_params)
        status_rows = r.mappings().all()

        # Top matched crops
        top_crops_stmt = text(f"""
            SELECT ct.name_en AS crop, COUNT(*) AS match_count, AVG(m.score) AS avg_score
            FROM matches m
            JOIN harvest_listings hl ON hl.id = m.harvest_id
            JOIN crop_taxonomy ct ON ct.id = hl.crop_id
            WHERE m.created_at >= NOW() - INTERVAL '{days} days'
            GROUP BY ct.name_en
            ORDER BY match_count DESC
            LIMIT 10
        """)
        r2 = await session.execute(top_crops_stmt)
        top_crop_rows = r2.mappings().all()

        # Conversion: confirmed + fulfilled / total
        total_matches = sum(row["count"] for row in status_rows)
        converted = sum(
            row["count"] for row in status_rows
            if row["status"] in ("confirmed", "fulfilled")
        )
        conversion_rate = round(converted / total_matches * 100, 2) if total_matches > 0 else 0.0

        return {
            "tool": "get_match_analytics",
            "period_days": days,
            "crop_filter": crop,
            "total_matches": total_matches,
            "conversion_rate_pct": conversion_rate,
            "status_breakdown": [
                {
                    "status": row["status"],
                    "count": row["count"],
                    "avg_score": round(float(row["avg_score"]), 4) if row["avg_score"] else None,
                }
                for row in status_rows
            ],
            "top_matched_crops": [
                {
                    "crop": row["crop"],
                    "match_count": row["match_count"],
                    "avg_score": round(float(row["avg_score"]), 4) if row["avg_score"] else None,
                }
                for row in top_crop_rows
            ],
        }


async def _handle_get_price_trends(params: dict) -> dict:
    """Return price trend data for a crop."""
    crop = params.get("crop", "")
    days = int(params.get("days", 90))
    district = params.get("district")

    async with async_session_factory() as session:
        pt_district_cond = "AND u.district ILIKE :district" if district else ""
        pt_params: dict[str, Any] = {"crop": f"%{crop}%"}
        if district:
            pt_params["district"] = f"%{district}%"

        stmt = text(f"""
            SELECT
                DATE_TRUNC('week', hl.created_at) AS week,
                AVG(hl.price_per_kg) AS avg_price,
                MIN(hl.price_per_kg) AS min_price,
                MAX(hl.price_per_kg) AS max_price,
                COUNT(*) AS listing_count
            FROM harvest_listings hl
            JOIN crop_taxonomy ct ON ct.id = hl.crop_id
            JOIN users u ON u.id = hl.farmer_id
            WHERE (ct.name_en ILIKE :crop OR ct.code ILIKE :crop)
              AND hl.price_per_kg IS NOT NULL
              AND hl.created_at >= NOW() - INTERVAL '{days} days'
              {pt_district_cond}
            GROUP BY DATE_TRUNC('week', hl.created_at)
            ORDER BY week ASC
        """)
        r = await session.execute(stmt, pt_params)
        rows = r.mappings().all()

        # Current average
        current_avg = rows[-1]["avg_price"] if rows else None
        first_avg = rows[0]["avg_price"] if rows else None
        price_change_pct = None
        if current_avg and first_avg and float(first_avg) > 0:
            price_change_pct = round((float(current_avg) - float(first_avg)) / float(first_avg) * 100, 2)

        return {
            "tool": "get_price_trends",
            "crop": crop,
            "district": district,
            "period_days": days,
            "current_avg_price_lkr": float(current_avg) if current_avg else None,
            "price_change_pct": price_change_pct,
            "weekly_trend": [
                {
                    "week": row["week"].date().isoformat() if row["week"] else None,
                    "avg_price": round(float(row["avg_price"]), 2) if row["avg_price"] else None,
                    "min_price": round(float(row["min_price"]), 2) if row["min_price"] else None,
                    "max_price": round(float(row["max_price"]), 2) if row["max_price"] else None,
                    "listing_count": row["listing_count"],
                }
                for row in rows
            ],
        }


async def _handle_get_diagnosis_insights(params: dict) -> dict:
    """Summarise crop diagnosis results."""
    days = int(params.get("days", 30))
    crop = params.get("crop")
    limit = int(params.get("limit", 10))

    async with async_session_factory() as session:
        di_crop_cond = "AND (ct.name_en ILIKE :crop OR ct.code ILIKE :crop)" if crop else ""
        di_params: dict[str, Any] = {"limit": limit}
        if crop:
            di_params["crop"] = f"%{crop}%"

        # Top diseases
        disease_stmt = text(f"""
            SELECT
                cd.disease_name,
                COUNT(*) AS count,
                AVG(cd.confidence) AS avg_confidence,
                ct.name_en AS crop_name
            FROM crop_diagnoses cd
            LEFT JOIN crop_taxonomy ct ON ct.id = cd.crop_id
            WHERE cd.created_at >= NOW() - INTERVAL '{days} days'
              AND cd.status = 'completed'
              AND cd.disease_name IS NOT NULL
              {di_crop_cond}
            GROUP BY cd.disease_name, ct.name_en
            ORDER BY count DESC
            LIMIT :limit
        """)
        r = await session.execute(disease_stmt, di_params)
        disease_rows = r.mappings().all()

        # Feedback distribution
        feedback_stmt = text(f"""
            SELECT user_feedback, COUNT(*) AS count
            FROM crop_diagnoses
            WHERE created_at >= NOW() - INTERVAL '{days} days'
              AND user_feedback IS NOT NULL
            GROUP BY user_feedback
        """)
        r2 = await session.execute(feedback_stmt)
        feedback_rows = r2.mappings().all()

        # Total stats
        total_stmt = text(f"""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'completed') AS completed,
                AVG(confidence) FILTER (WHERE status = 'completed') AS avg_confidence
            FROM crop_diagnoses
            WHERE created_at >= NOW() - INTERVAL '{days} days'
        """)
        r3 = await session.execute(total_stmt)
        totals = r3.mappings().one()

        return {
            "tool": "get_diagnosis_insights",
            "period_days": days,
            "crop_filter": crop,
            "total_diagnoses": totals["total"],
            "completed_diagnoses": totals["completed"],
            "avg_confidence": round(float(totals["avg_confidence"]), 4) if totals["avg_confidence"] else None,
            "top_diseases": [
                {
                    "disease_name": row["disease_name"],
                    "count": row["count"],
                    "avg_confidence": round(float(row["avg_confidence"]), 4) if row["avg_confidence"] else None,
                    "crop": row["crop_name"],
                }
                for row in disease_rows
            ],
            "user_feedback": {
                row["user_feedback"]: row["count"] for row in feedback_rows
            },
        }


async def _handle_get_weather_summary(params: dict) -> dict:
    """Return cached weather advisory data."""
    district = params.get("district")
    province = params.get("province")

    # GoviHub stores weather advisories inside alerts; if alerts table not yet live,
    # return a structured placeholder with the requested location metadata.
    location_info = {
        "district": district,
        "province": province,
        "country": "Sri Lanka",
    }

    try:
        async with async_session_factory() as session:
            # Try to query weather-type alerts if the alerts table exists
            ws_district_cond = "AND a.district ILIKE :district" if district else ""
            ws_province_cond = "AND a.province ILIKE :province" if province else ""
            ws_params: dict[str, Any] = {}
            if district:
                ws_params["district"] = f"%{district}%"
            if province:
                ws_params["province"] = f"%{province}%"

            stmt = text(f"""
                SELECT
                    a.title,
                    a.message,
                    a.severity,
                    a.created_at,
                    a.metadata
                FROM alerts a
                WHERE a.alert_type = 'weather'
                  {ws_district_cond}
                  {ws_province_cond}
                  AND a.created_at >= NOW() - INTERVAL '7 days'
                ORDER BY a.created_at DESC
                LIMIT 5
            """)
            r = await session.execute(stmt, ws_params)
            rows = r.mappings().all()
            advisories = [
                {
                    "title": row["title"],
                    "message": row["message"],
                    "severity": row["severity"],
                    "issued_at": row["created_at"].isoformat() if row["created_at"] else None,
                    "metadata": row["metadata"],
                }
                for row in rows
            ]
    except Exception:
        advisories = []

    return {
        "tool": "get_weather_summary",
        "location": location_info,
        "advisories": advisories,
        "note": (
            "Live weather data is fetched via OpenWeather API by the alerts module. "
            "This endpoint surfaces cached platform advisories."
        ),
    }


async def _handle_get_platform_stats(params: dict) -> dict:
    """Return high-level platform statistics."""
    include_growth = bool(params.get("include_growth", False))

    async with async_session_factory() as session:
        user_stmt = text("""
            SELECT role, COUNT(*) AS count
            FROM users
            WHERE is_active = TRUE
            GROUP BY role
        """)
        r = await session.execute(user_stmt)
        user_rows = r.mappings().all()
        users_by_role = {row["role"]: row["count"] for row in user_rows}

        listing_stmt = text("""
            SELECT COUNT(*) AS harvest_active
            FROM harvest_listings
            WHERE status IN ('planned', 'ready')
        """)
        r2 = await session.execute(listing_stmt)
        harvest_active = r2.scalar()

        demand_stmt = text("""
            SELECT COUNT(*) AS demand_active
            FROM demand_postings
            WHERE status IN ('open', 'reviewing')
        """)
        r3 = await session.execute(demand_stmt)
        demand_active = r3.scalar()

        match_stmt = text("""
            SELECT COUNT(*) AS matches_this_month
            FROM matches
            WHERE created_at >= DATE_TRUNC('month', NOW())
        """)
        r4 = await session.execute(match_stmt)
        matches_this_month = r4.scalar()

        diag_stmt = text("""
            SELECT COUNT(*) AS diagnoses_this_week
            FROM crop_diagnoses
            WHERE created_at >= NOW() - INTERVAL '7 days'
        """)
        r5 = await session.execute(diag_stmt)
        diagnoses_this_week = r5.scalar()

        advisory_stmt = text("""
            SELECT COUNT(*) AS questions_answered
            FROM advisory_questions
            WHERE answer_text IS NOT NULL
        """)
        r6 = await session.execute(advisory_stmt)
        questions_answered = r6.scalar()

        stats = {
            "tool": "get_platform_stats",
            "users": {
                "total": sum(users_by_role.values()),
                "by_role": users_by_role,
            },
            "listings": {
                "active_harvest": harvest_active,
                "active_demand": demand_active,
            },
            "matches": {
                "this_month": matches_this_month,
            },
            "diagnosis": {
                "this_week": diagnoses_this_week,
            },
            "advisory": {
                "questions_answered_total": questions_answered,
            },
        }

        if include_growth:
            # Previous month user count for growth calc
            prev_stmt = text("""
                SELECT COUNT(*) AS prev_month_users
                FROM users
                WHERE is_active = TRUE
                  AND created_at < DATE_TRUNC('month', NOW())
                  AND created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
            """)
            r7 = await session.execute(prev_stmt)
            prev_users = r7.scalar() or 0
            total_users = sum(users_by_role.values())
            growth_pct = round(
                (total_users - prev_users) / prev_users * 100, 2
            ) if prev_users > 0 else None
            stats["growth"] = {
                "new_users_prev_month": prev_users,
                "user_growth_pct": growth_pct,
            }

        return stats


async def _handle_search_knowledge_base(params: dict) -> dict:
    """Full-text search across knowledge chunks."""
    query = params.get("query", "")
    category = params.get("category")
    language = params.get("language")
    limit = min(int(params.get("limit", 10)), 50)

    async with async_session_factory() as session:
        kb_cat_cond = "AND kc.category ILIKE :category" if category else ""
        kb_lang_cond = "AND kc.language = :language" if language else ""
        kb_params: dict[str, Any] = {"query": query, "limit": limit}
        if category:
            kb_params["category"] = f"%{category}%"
        if language:
            kb_params["language"] = language

        stmt = text(f"""
            SELECT
                kc.id,
                kc.source,
                kc.title,
                kc.content,
                kc.language,
                kc.category,
                kc.tags,
                ts_rank(
                    to_tsvector('english', kc.content),
                    plainto_tsquery('english', :query)
                ) AS rank
            FROM knowledge_chunks kc
            WHERE to_tsvector('english', kc.content) @@ plainto_tsquery('english', :query)
              {kb_cat_cond}
              {kb_lang_cond}
            ORDER BY rank DESC
            LIMIT :limit
        """)
        r = await session.execute(stmt, kb_params)
        rows = r.mappings().all()

        return {
            "tool": "search_knowledge_base",
            "query": query,
            "count": len(rows),
            "results": [
                {
                    "id": str(row["id"]),
                    "source": row["source"],
                    "title": row["title"],
                    "content_snippet": (row["content"] or "")[:500],
                    "language": row["language"],
                    "category": row["category"],
                    "tags": row["tags"],
                    "relevance_score": round(float(row["rank"]), 4) if row["rank"] else 0.0,
                }
                for row in rows
            ],
        }


async def _handle_get_farmer_profile(params: dict) -> dict:
    """Retrieve a farmer's full profile."""
    user_id = params.get("user_id", "")

    async with async_session_factory() as session:
        user_stmt = text("""
            SELECT
                u.id, u.name, u.email, u.district, u.province, u.gn_division,
                u.is_verified, u.is_active, u.language, u.created_at, u.last_login_at,
                fp.farm_size_acres, fp.primary_crops, fp.irrigation_type, fp.cooperative
            FROM users u
            LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
            WHERE u.id = :user_id AND u.role = 'farmer'
        """)
        r = await session.execute(user_stmt, {"user_id": user_id})
        row = r.mappings().one_or_none()

        if not row:
            return {
                "tool": "get_farmer_profile",
                "error": f"Farmer with id {user_id} not found",
            }

        # Active listings count
        listing_stmt = text("""
            SELECT COUNT(*) AS active_listings
            FROM harvest_listings
            WHERE farmer_id = :user_id AND status IN ('planned', 'ready')
        """)
        r2 = await session.execute(listing_stmt, {"user_id": user_id})
        active_listings = r2.scalar()

        # Match history summary
        match_stmt = text("""
            SELECT m.status, COUNT(*) AS count
            FROM matches m
            JOIN harvest_listings hl ON hl.id = m.harvest_id
            WHERE hl.farmer_id = :user_id
            GROUP BY m.status
        """)
        r3 = await session.execute(match_stmt, {"user_id": user_id})
        match_rows = r3.mappings().all()

        return {
            "tool": "get_farmer_profile",
            "id": str(row["id"]),
            "name": row["name"],
            "district": row["district"],
            "province": row["province"],
            "gn_division": row["gn_division"],
            "is_verified": row["is_verified"],
            "is_active": row["is_active"],
            "language": row["language"],
            "member_since": row["created_at"].isoformat() if row["created_at"] else None,
            "last_login_at": row["last_login_at"].isoformat() if row["last_login_at"] else None,
            "farm_details": {
                "farm_size_acres": float(row["farm_size_acres"]) if row["farm_size_acres"] else None,
                "primary_crops": row["primary_crops"] or [],
                "irrigation_type": row["irrigation_type"],
                "cooperative": row["cooperative"],
            },
            "active_harvest_listings": active_listings,
            "match_history": {
                row["status"]: row["count"] for row in match_rows
            },
        }


async def _handle_get_supply_chain_overview(params: dict) -> dict:
    """Overview of supply chain / supply listings."""
    category = params.get("category")
    district = params.get("district")
    limit = min(int(params.get("limit", 20)), 100)

    async with async_session_factory() as session:
        # Category summary
        cat_stmt = text("""
            SELECT
                sl.category,
                COUNT(*) AS listing_count,
                COUNT(DISTINCT sl.supplier_id) AS supplier_count,
                AVG(sl.price) AS avg_price
            FROM supply_listings sl
            WHERE sl.status = 'active'
            GROUP BY sl.category
            ORDER BY listing_count DESC
        """)
        r = await session.execute(cat_stmt)
        cat_rows = r.mappings().all()

        sc_cat_cond = "AND sl.category::text = :category" if category else ""
        sc_dist_cond = "AND u.district ILIKE :district" if district else ""
        sc_params: dict[str, Any] = {"limit": limit}
        if category:
            sc_params["category"] = category
        if district:
            sc_params["district"] = f"%{district}%"

        # Top suppliers filtered
        supplier_stmt = text(f"""
            SELECT
                u.id,
                u.name,
                u.district,
                sp.business_name,
                sp.categories,
                COUNT(sl.id) AS active_listings
            FROM supply_listings sl
            JOIN users u ON u.id = sl.supplier_id
            LEFT JOIN supplier_profiles sp ON sp.user_id = u.id
            WHERE sl.status = 'active'
              {sc_cat_cond}
              {sc_dist_cond}
            GROUP BY u.id, u.name, u.district, sp.business_name, sp.categories
            ORDER BY active_listings DESC
            LIMIT :limit
        """)
        r2 = await session.execute(supplier_stmt, sc_params)
        supplier_rows = r2.mappings().all()

        return {
            "tool": "get_supply_chain_overview",
            "filters_applied": {"category": category, "district": district},
            "category_summary": [
                {
                    "category": row["category"],
                    "listing_count": row["listing_count"],
                    "supplier_count": row["supplier_count"],
                    "avg_price": round(float(row["avg_price"]), 2) if row["avg_price"] else None,
                }
                for row in cat_rows
            ],
            "top_suppliers": [
                {
                    "id": str(row["id"]),
                    "name": row["name"],
                    "business_name": row["business_name"],
                    "district": row["district"],
                    "categories": row["categories"],
                    "active_listings": row["active_listings"],
                }
                for row in supplier_rows
            ],
        }


# ---------------------------------------------------------------------------
# Admin / Monitoring Handlers (6 new)
# ---------------------------------------------------------------------------

async def _handle_govihub_get_registrations(params: dict) -> dict:
    """Get user registrations with role breakdown."""
    days = int(params.get("days", 7))
    role = params.get("role")

    async with async_session_factory() as session:
        reg_role_cond = "AND role = :role" if role else ""
        reg_params: dict[str, Any] = {}
        if role:
            reg_params["role"] = role

        # Individual registrations
        reg_stmt = text(f"""
            SELECT id, name, username, role, district, language, created_at
            FROM users
            WHERE created_at >= NOW() - INTERVAL '{days} days'
              {reg_role_cond}
            ORDER BY created_at DESC
        """)
        r = await session.execute(reg_stmt, reg_params)
        rows = r.mappings().all()

        # Summary by role
        summary_stmt = text(f"""
            SELECT role, COUNT(*) AS count
            FROM users
            WHERE created_at >= NOW() - INTERVAL '{days} days'
            GROUP BY role
        """)
        r2 = await session.execute(summary_stmt)
        summary_rows = r2.mappings().all()
        by_role = {row["role"]: row["count"] for row in summary_rows}

        registrations = [
            {
                "id": str(row["id"]),
                "name": row["name"],
                "username": row["username"],
                "role": row["role"],
                "district": row["district"],
                "language": row["language"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            }
            for row in rows
        ]

        return {
            "tool": "govihub_get_registrations",
            "period_days": days,
            "role_filter": role,
            "registrations": registrations,
            "summary": {
                "total": sum(by_role.values()),
                "by_role": {
                    "farmer": by_role.get("farmer", 0),
                    "buyer": by_role.get("buyer", 0),
                    "supplier": by_role.get("supplier", 0),
                    "admin": by_role.get("admin", 0),
                },
            },
        }


async def _handle_govihub_get_user_activity(params: dict) -> dict:
    """User engagement metrics across the platform."""
    days = int(params.get("days", 7))
    activity_type = params.get("activity_type")

    activity_queries = {
        "listing_created": f"""
            SELECT hl.farmer_id AS user_id, u.name, u.role,
                   DATE(hl.created_at) AS activity_date, COUNT(*) AS count
            FROM harvest_listings hl
            JOIN users u ON u.id = hl.farmer_id
            WHERE hl.created_at >= NOW() - INTERVAL '{days} days'
            GROUP BY hl.farmer_id, u.name, u.role, DATE(hl.created_at)
        """,
        "demand_created": f"""
            SELECT dp.buyer_id AS user_id, u.name, u.role,
                   DATE(dp.created_at) AS activity_date, COUNT(*) AS count
            FROM demand_postings dp
            JOIN users u ON u.id = dp.buyer_id
            WHERE dp.created_at >= NOW() - INTERVAL '{days} days'
            GROUP BY dp.buyer_id, u.name, u.role, DATE(dp.created_at)
        """,
        "match_activity": f"""
            SELECT m.updated_by AS user_id, u.name, u.role,
                   DATE(m.updated_at) AS activity_date, COUNT(*) AS count
            FROM matches m
            JOIN users u ON u.id = m.updated_by
            WHERE m.updated_at >= NOW() - INTERVAL '{days} days'
              AND m.updated_by IS NOT NULL
            GROUP BY m.updated_by, u.name, u.role, DATE(m.updated_at)
        """,
        "diagnosis_uploaded": f"""
            SELECT cd.user_id AS user_id, u.name, u.role,
                   DATE(cd.created_at) AS activity_date, COUNT(*) AS count
            FROM crop_diagnoses cd
            JOIN users u ON u.id = cd.user_id
            WHERE cd.created_at >= NOW() - INTERVAL '{days} days'
            GROUP BY cd.user_id, u.name, u.role, DATE(cd.created_at)
        """,
        "feedback_submitted": f"""
            SELECT bf.user_id AS user_id, u.name, u.role,
                   DATE(bf.created_at) AS activity_date, COUNT(*) AS count
            FROM beta_feedback bf
            JOIN users u ON u.id = bf.user_id
            WHERE bf.created_at >= NOW() - INTERVAL '{days} days'
            GROUP BY bf.user_id, u.name, u.role, DATE(bf.created_at)
        """,
        "login": f"""
            SELECT id AS user_id, name, role,
                   DATE(last_login_at) AS activity_date, 1 AS count
            FROM users
            WHERE last_login_at >= NOW() - INTERVAL '{days} days'
        """,
    }

    # Filter to requested type or run all
    types_to_run = (
        {activity_type: activity_queries[activity_type]}
        if activity_type and activity_type in activity_queries
        else activity_queries
    )

    activity_counts: dict[str, int] = {}
    most_active_users: dict[str, int] = {}
    daily_trends: dict[str, dict[str, int]] = {}

    async with async_session_factory() as session:
        for a_type, sql in types_to_run.items():
            try:
                r = await session.execute(text(sql))
                rows = r.mappings().all()
            except Exception:
                # Table might not exist yet; skip gracefully
                rows = []

            type_total = sum(row["count"] for row in rows)
            activity_counts[a_type] = type_total

            for row in rows:
                uid = str(row["user_id"])
                name = row["name"] or uid
                most_active_users[name] = most_active_users.get(name, 0) + row["count"]

                day_str = row["activity_date"].isoformat() if row["activity_date"] else "unknown"
                if day_str not in daily_trends:
                    daily_trends[day_str] = {}
                daily_trends[day_str][a_type] = daily_trends[day_str].get(a_type, 0) + row["count"]

    # Sort most active
    top_users = sorted(most_active_users.items(), key=lambda x: x[1], reverse=True)[:10]
    # Sort daily trends by date
    sorted_daily = dict(sorted(daily_trends.items()))

    return {
        "tool": "govihub_get_user_activity",
        "period_days": days,
        "activity_type_filter": activity_type,
        "activity_counts": activity_counts,
        "most_active_users": [
            {"name": name, "total_actions": count} for name, count in top_users
        ],
        "daily_trends": sorted_daily,
    }


async def _handle_govihub_get_feedback(params: dict) -> dict:
    """Get beta feedback and feature requests."""
    days = int(params.get("days", 30))
    category = params.get("category")
    language = params.get("language")

    async with async_session_factory() as session:
        fb_cat_cond = "AND bf.category = :category" if category else ""
        fb_lang_cond = "AND bf.language = :language" if language else ""
        fb_params: dict[str, Any] = {}
        if category:
            fb_params["category"] = category
        if language:
            fb_params["language"] = language

        feedback_stmt = text(f"""
            SELECT
                bf.id,
                bf.category,
                bf.message,
                bf.rating,
                bf.language,
                bf.created_at,
                u.name,
                u.role,
                u.district
            FROM beta_feedback bf
            LEFT JOIN users u ON bf.user_id = u.id
            WHERE bf.created_at >= NOW() - INTERVAL '{days} days'
              {fb_cat_cond}
              {fb_lang_cond}
            ORDER BY bf.created_at DESC
        """)
        r = await session.execute(feedback_stmt, fb_params)
        rows = r.mappings().all()

        # Summary stats
        summary_stmt = text(f"""
            SELECT
                COUNT(*) AS total,
                AVG(rating) AS avg_rating,
                category,
                COUNT(*) AS cat_count
            FROM beta_feedback
            WHERE created_at >= NOW() - INTERVAL '{days} days'
            GROUP BY category
        """)
        r2 = await session.execute(summary_stmt)
        summary_rows = r2.mappings().all()
        by_category = {row["category"]: row["cat_count"] for row in summary_rows}
        total = sum(by_category.values())

        # Avg rating across all
        avg_stmt = text(f"""
            SELECT AVG(rating) AS avg_rating
            FROM beta_feedback
            WHERE created_at >= NOW() - INTERVAL '{days} days'
              AND rating IS NOT NULL
        """)
        r3 = await session.execute(avg_stmt)
        avg_row = r3.mappings().one()
        avg_rating = round(float(avg_row["avg_rating"]), 2) if avg_row["avg_rating"] else None

        feedback_items = [
            {
                "id": str(row["id"]),
                "category": row["category"],
                "message": row["message"],
                "rating": row["rating"],
                "language": row["language"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "user_name": row["name"],
                "user_role": row["role"],
                "user_district": row["district"],
            }
            for row in rows
        ]

        return {
            "tool": "govihub_get_feedback",
            "period_days": days,
            "filters": {"category": category, "language": language},
            "feedback": feedback_items,
            "summary": {
                "total": total,
                "avg_rating": avg_rating,
                "by_category": by_category,
            },
        }


async def _handle_govihub_get_platform_stats(params: dict) -> dict:
    """Comprehensive platform statistics."""
    async with async_session_factory() as session:
        # Users by role
        user_stmt = text("SELECT role, COUNT(*) AS count FROM users GROUP BY role")
        r = await session.execute(user_stmt)
        users_by_role = {row["role"]: row["count"] for row in r.mappings().all()}

        # Harvest listings by status
        hl_stmt = text(
            "SELECT status, COUNT(*) AS count FROM harvest_listings GROUP BY status"
        )
        r2 = await session.execute(hl_stmt)
        harvest_by_status = {row["status"]: row["count"] for row in r2.mappings().all()}

        # Demand postings by status
        dp_stmt = text(
            "SELECT status, COUNT(*) AS count FROM demand_postings GROUP BY status"
        )
        r3 = await session.execute(dp_stmt)
        demand_by_status = {row["status"]: row["count"] for row in r3.mappings().all()}

        # Matches by status
        m_stmt = text(
            "SELECT status, COUNT(*) AS count FROM matches GROUP BY status"
        )
        r4 = await session.execute(m_stmt)
        matches_by_status = {row["status"]: row["count"] for row in r4.mappings().all()}

        # Diagnoses total
        diag_stmt = text("SELECT COUNT(*) AS count FROM crop_diagnoses")
        r5 = await session.execute(diag_stmt)
        diagnoses_total = r5.scalar()

        # Feedback total
        fb_stmt = text("SELECT COUNT(*) AS count FROM beta_feedback")
        r6 = await session.execute(fb_stmt)
        feedback_total = r6.scalar()

        return {
            "tool": "govihub_get_platform_stats",
            "users": {
                "total": sum(users_by_role.values()),
                "by_role": users_by_role,
            },
            "harvest_listings": {
                "total": sum(harvest_by_status.values()),
                "by_status": harvest_by_status,
            },
            "demand_postings": {
                "total": sum(demand_by_status.values()),
                "by_status": demand_by_status,
            },
            "matches": {
                "total": sum(matches_by_status.values()),
                "by_status": matches_by_status,
            },
            "diagnoses": {"total": diagnoses_total},
            "feedback": {"total": feedback_total},
        }


async def _handle_govihub_get_listings_summary(params: dict) -> dict:
    """Harvest and demand listings summary grouped by crop."""
    status = params.get("status")
    district = params.get("district")
    days = int(params.get("days", 30))

    async with async_session_factory() as session:
        ls_status_cond = "AND hl.status::text = :status" if status else ""
        ls_district_cond = "AND u.district ILIKE :district" if district else ""
        ls_params: dict[str, Any] = {}
        if status:
            ls_params["status"] = status
        if district:
            ls_params["district"] = f"%{district}%"

        # Harvest listings grouped by crop
        harvest_stmt = text(f"""
            SELECT
                ct.name_en AS crop_name,
                ct.code AS crop_code,
                hl.status,
                COUNT(*) AS listing_count,
                COALESCE(SUM(hl.quantity_kg), 0) AS total_quantity_kg,
                AVG(hl.price_per_kg) AS avg_price_per_kg
            FROM harvest_listings hl
            JOIN crop_taxonomy ct ON ct.id = hl.crop_id
            JOIN users u ON u.id = hl.farmer_id
            WHERE hl.created_at >= NOW() - INTERVAL '{days} days'
              {ls_status_cond}
              {ls_district_cond}
            GROUP BY ct.name_en, ct.code, hl.status
            ORDER BY total_quantity_kg DESC
        """)
        r = await session.execute(harvest_stmt, ls_params)
        harvest_rows = r.mappings().all()

        ds_status_cond = "AND dp.status::text = :status" if status else ""
        ds_district_cond = "AND u.district ILIKE :district" if district else ""

        # Demand postings grouped by crop
        demand_stmt = text(f"""
            SELECT
                ct.name_en AS crop_name,
                ct.code AS crop_code,
                dp.status,
                COUNT(*) AS posting_count,
                COALESCE(SUM(dp.quantity_kg), 0) AS total_quantity_kg,
                AVG(dp.max_price_per_kg) AS avg_max_price_per_kg
            FROM demand_postings dp
            JOIN crop_taxonomy ct ON ct.id = dp.crop_id
            JOIN users u ON u.id = dp.buyer_id
            WHERE dp.created_at >= NOW() - INTERVAL '{days} days'
              {ds_status_cond}
              {ds_district_cond}
            GROUP BY ct.name_en, ct.code, dp.status
            ORDER BY total_quantity_kg DESC
        """)
        r2 = await session.execute(demand_stmt, ls_params)
        demand_rows = r2.mappings().all()

        return {
            "tool": "govihub_get_listings_summary",
            "period_days": days,
            "filters": {"status": status, "district": district},
            "harvest_by_crop": [
                {
                    "crop_name": row["crop_name"],
                    "crop_code": row["crop_code"],
                    "status": row["status"],
                    "listing_count": row["listing_count"],
                    "total_quantity_kg": float(row["total_quantity_kg"]),
                    "avg_price_per_kg": round(float(row["avg_price_per_kg"]), 2) if row["avg_price_per_kg"] else None,
                }
                for row in harvest_rows
            ],
            "demand_by_crop": [
                {
                    "crop_name": row["crop_name"],
                    "crop_code": row["crop_code"],
                    "status": row["status"],
                    "posting_count": row["posting_count"],
                    "total_quantity_kg": float(row["total_quantity_kg"]),
                    "avg_max_price_per_kg": round(float(row["avg_max_price_per_kg"]), 2) if row["avg_max_price_per_kg"] else None,
                }
                for row in demand_rows
            ],
        }


async def _handle_govihub_get_match_performance(params: dict) -> dict:
    """Matching engine funnel metrics."""
    days = int(params.get("days", 30))

    async with async_session_factory() as session:
        # Counts by status
        funnel_stmt = text(f"""
            SELECT status, COUNT(*) AS count, AVG(score) AS avg_score
            FROM matches
            WHERE created_at >= NOW() - INTERVAL '{days} days'
            GROUP BY status
        """)
        r = await session.execute(funnel_stmt)
        funnel_rows = r.mappings().all()
        status_counts = {row["status"]: row["count"] for row in funnel_rows}
        status_scores = {
            row["status"]: round(float(row["avg_score"]), 4) if row["avg_score"] else None
            for row in funnel_rows
        }

        total = sum(status_counts.values())
        proposed = status_counts.get("proposed", 0)
        accepted = status_counts.get("accepted", 0)
        confirmed = status_counts.get("confirmed", 0)
        fulfilled = status_counts.get("fulfilled", 0)
        disputed = status_counts.get("disputed", 0)
        rejected = status_counts.get("rejected", 0)

        # Conversion rates
        def _rate(numerator: int, denominator: int) -> float | None:
            return round(numerator / denominator * 100, 2) if denominator > 0 else None

        return {
            "tool": "govihub_get_match_performance",
            "period_days": days,
            "total_matches": total,
            "funnel": {
                "proposed": proposed,
                "accepted": accepted,
                "confirmed": confirmed,
                "fulfilled": fulfilled,
                "rejected": rejected,
                "disputed": disputed,
            },
            "avg_scores_by_status": status_scores,
            "conversion_rates": {
                "proposed_to_accepted_pct": _rate(accepted, proposed),
                "accepted_to_confirmed_pct": _rate(confirmed, accepted),
                "confirmed_to_fulfilled_pct": _rate(fulfilled, confirmed),
                "overall_fulfillment_pct": _rate(fulfilled, total),
                "dispute_rate_pct": _rate(disputed, total),
                "rejection_rate_pct": _rate(rejected, total),
            },
        }


# ---------------------------------------------------------------------------
# Handler Dispatch Map
# ---------------------------------------------------------------------------

TOOL_HANDLERS: dict[str, Any] = {
    "search_farmers": _handle_search_farmers,
    "search_listings": _handle_search_listings,
    "get_match_analytics": _handle_get_match_analytics,
    "get_price_trends": _handle_get_price_trends,
    "get_diagnosis_insights": _handle_get_diagnosis_insights,
    "get_weather_summary": _handle_get_weather_summary,
    "get_platform_stats": _handle_get_platform_stats,
    "search_knowledge_base": _handle_search_knowledge_base,
    "get_farmer_profile": _handle_get_farmer_profile,
    "get_supply_chain_overview": _handle_get_supply_chain_overview,
    # Admin / monitoring tools
    "govihub_get_registrations": _handle_govihub_get_registrations,
    "govihub_get_user_activity": _handle_govihub_get_user_activity,
    "govihub_get_feedback": _handle_govihub_get_feedback,
    "govihub_get_platform_stats": _handle_govihub_get_platform_stats,
    "govihub_get_listings_summary": _handle_govihub_get_listings_summary,
    "govihub_get_match_performance": _handle_govihub_get_match_performance,
}
