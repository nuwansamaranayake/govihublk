"""Admin AI Intelligence query — OpenRouter chat with tool-calling.

The admin types a natural-language question (e.g. "how many farmers in
Anuradhapura signed up this month?"). We round-trip with an OpenRouter chat
model that has access to a small set of read-only SQL aggregation tools, then
return the final natural-language answer back to the panel.

Design:
  - Model: settings.OPENROUTER_MODEL (set to a tool-capable cheap model in
    the spices env; spec calls for deepseek/deepseek-chat).
  - Tool loop capped at MAX_ITERATIONS=5 to bound cost and latency.
  - Per-admin Redis rate limit: 30 queries / rolling hour.
  - All tool implementations are read-only SELECTs — no mutations possible
    via the AI path.
  - Query length validated 3..500 chars (CRITICAL RULE #10).
"""

from __future__ import annotations

import json
import time
from typing import Any, Optional
from uuid import UUID

import httpx
import structlog
from redis import asyncio as aioredis
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ads.models import Advertisement
from app.config import settings
from app.exceptions import ExternalServiceError, ValidationError
from app.listings.models import (
    CropTaxonomy,
    DemandPosting,
    DemandStatus,
    HarvestListing,
    HarvestStatus,
)
from app.marketplace.models import SupplyListing
from app.matching.models import Match
from app.users.models import User, UserRole

logger = structlog.get_logger()


MAX_ITERATIONS = 5
RATE_LIMIT_PER_HOUR = 30
MIN_QUERY_LEN = 3
MAX_QUERY_LEN = 500
HTTP_TIMEOUT_SECONDS = 60.0

SYSTEM_PROMPT = (
    "You are the GoviHub admin intelligence assistant. "
    "GoviHub is Sri Lanka's AI-powered spice farming marketplace. "
    "Spice crops in scope: black pepper, cinnamon, turmeric, ginger, "
    "cardamom, cloves, nutmeg. "
    "User roles: farmers (sell crops), buyers (purchase crops), "
    "suppliers (sell inputs/services).\n\n"
    "You have read-only tools to query live platform data. Use them to "
    "answer the admin's question. Be concise. Give specific numbers. "
    "Add one short actionable insight only when it is clearly useful. "
    "Use plain text. Do not use markdown headers or asterisks."
)


# ---------------------------------------------------------------------------
# Tool catalogue exposed to the model
# ---------------------------------------------------------------------------


TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_platform_overview",
            "description": (
                "Get overall platform statistics: user counts by role, "
                "harvest/demand/supply listing counts, match counts, and "
                "active ads count."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_stats",
            "description": (
                "User registration statistics filterable by period and role."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {
                        "type": "string",
                        "enum": ["today", "week", "month", "all"],
                        "description": "Time window relative to now (UTC).",
                    },
                    "role": {
                        "type": "string",
                        "enum": ["farmer", "buyer", "supplier", "admin", "all"],
                    },
                    "district": {
                        "type": "string",
                        "description": "Optional Sri Lankan district name filter.",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_listing_stats",
            "description": (
                "Listing counts by kind (harvest/demand/supply) and status. "
                "Excludes admin-removed rows."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "kind": {
                        "type": "string",
                        "enum": ["harvest", "demand", "supply", "all"],
                    },
                    "status": {"type": "string"},
                    "crop": {"type": "string", "description": "Crop name (en or si)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_match_stats",
            "description": (
                "Match counts and average score, optionally filtered by status "
                "and/or by time period (today, week, month, all)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string"},
                    "period": {
                        "type": "string",
                        "enum": ["today", "week", "month", "all"],
                        "description": "Time window relative to now (UTC).",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_district_breakdown",
            "description": (
                "User counts grouped by Sri Lankan district. Returns top N."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "minimum": 1, "maximum": 50},
                    "role": {
                        "type": "string",
                        "enum": ["farmer", "buyer", "supplier", "all"],
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_active_ads",
            "description": "List currently-active advertisements with impression counts.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "minimum": 1, "maximum": 25},
                },
            },
        },
    },
]


# ---------------------------------------------------------------------------
# Tool implementations (read-only)
# ---------------------------------------------------------------------------


async def _tool_platform_overview(db: AsyncSession, _: dict) -> dict:
    user_rows = (
        await db.execute(
            select(User.role, func.count())
            .where(User.deleted_at.is_(None))
            .group_by(User.role)
        )
    ).all()
    users_by_role = {
        (r.value if hasattr(r, "value") else str(r)): int(c) for r, c in user_rows
    }

    harvest_total = (
        await db.execute(
            select(func.count())
            .select_from(HarvestListing)
            .where(HarvestListing.removed_at.is_(None))
        )
    ).scalar_one()
    demand_total = (
        await db.execute(
            select(func.count())
            .select_from(DemandPosting)
            .where(DemandPosting.removed_at.is_(None))
        )
    ).scalar_one()
    supply_total = (
        await db.execute(
            select(func.count())
            .select_from(SupplyListing)
            .where(SupplyListing.removed_at.is_(None))
        )
    ).scalar_one()
    matches_total = (
        await db.execute(select(func.count()).select_from(Match))
    ).scalar_one()

    now_utc = func.now()
    active_ads = (
        await db.execute(
            select(func.count())
            .select_from(Advertisement)
            .where(
                Advertisement.is_active.is_(True),
                Advertisement.starts_at <= now_utc,
                Advertisement.ends_at >= now_utc,
            )
        )
    ).scalar_one()

    return {
        "users_by_role": users_by_role,
        "harvest_listings": int(harvest_total),
        "demand_postings": int(demand_total),
        "supply_listings": int(supply_total),
        "matches": int(matches_total),
        "active_ads": int(active_ads),
    }


_PERIOD_TO_INTERVAL = {
    "today": "1 day",
    "week": "7 days",
    "month": "30 days",
}


async def _tool_user_stats(db: AsyncSession, args: dict) -> dict:
    period = args.get("period", "all")
    role = args.get("role", "all")
    district = args.get("district")

    query = select(func.count()).select_from(User).where(User.deleted_at.is_(None))
    if role != "all":
        query = query.where(User.role == role)
    if district:
        query = query.where(User.district.ilike(district))
    if period in _PERIOD_TO_INTERVAL:
        query = query.where(
            User.created_at >= func.now() - text(f"INTERVAL '{_PERIOD_TO_INTERVAL[period]}'")
        )

    count = (await db.execute(query)).scalar_one()
    return {
        "period": period,
        "role": role,
        "district": district,
        "count": int(count),
    }


async def _tool_listing_stats(db: AsyncSession, args: dict) -> dict:
    kind = args.get("kind", "all")
    status_arg = args.get("status")
    crop_name = args.get("crop")

    crop_id: Optional[UUID] = None
    if crop_name:
        pattern = f"%{crop_name}%"
        crop_row = (
            await db.execute(
                select(CropTaxonomy.id).where(
                    (CropTaxonomy.name_en.ilike(pattern))
                    | (CropTaxonomy.name_si.ilike(pattern))
                    | (CropTaxonomy.code.ilike(pattern))
                )
            )
        ).first()
        if crop_row:
            crop_id = crop_row[0]
        else:
            return {"kind": kind, "crop": crop_name, "match": "crop_not_found"}

    out: dict[str, Any] = {"kind": kind, "status": status_arg, "crop": crop_name}

    async def _count_for(model, status_attr):
        q = select(func.count()).select_from(model).where(model.removed_at.is_(None))
        if status_arg:
            q = q.where(status_attr == status_arg)
        if crop_id and hasattr(model, "crop_id"):
            q = q.where(model.crop_id == crop_id)
        return int((await db.execute(q)).scalar_one())

    if kind in ("harvest", "all"):
        out["harvest_count"] = await _count_for(HarvestListing, HarvestListing.status)
    if kind in ("demand", "all"):
        out["demand_count"] = await _count_for(DemandPosting, DemandPosting.status)
    if kind in ("supply", "all"):
        # supply has no crop link; ignore crop filter for it
        q = select(func.count()).select_from(SupplyListing).where(SupplyListing.removed_at.is_(None))
        if status_arg:
            q = q.where(SupplyListing.status == status_arg)
        out["supply_count"] = int((await db.execute(q)).scalar_one())
    return out


async def _tool_match_stats(db: AsyncSession, args: dict) -> dict:
    status_arg = args.get("status")
    period = args.get("period", "all")
    q_count = select(func.count()).select_from(Match)
    q_avg = select(func.avg(Match.score)).select_from(Match)
    if status_arg:
        q_count = q_count.where(Match.status == status_arg)
        q_avg = q_avg.where(Match.status == status_arg)
    if period in _PERIOD_TO_INTERVAL:
        cutoff = func.now() - text(f"INTERVAL '{_PERIOD_TO_INTERVAL[period]}'")
        q_count = q_count.where(Match.created_at >= cutoff)
        q_avg = q_avg.where(Match.created_at >= cutoff)
    count = int((await db.execute(q_count)).scalar_one())
    avg = (await db.execute(q_avg)).scalar()
    return {
        "status": status_arg,
        "period": period,
        "count": count,
        "average_score": float(avg) if avg is not None else None,
    }


async def _tool_district_breakdown(db: AsyncSession, args: dict) -> dict:
    limit = max(1, min(int(args.get("limit", 10)), 50))
    role = args.get("role", "all")
    q = (
        select(User.district, func.count())
        .where(User.deleted_at.is_(None), User.district.isnot(None))
        .group_by(User.district)
        .order_by(func.count().desc())
        .limit(limit)
    )
    if role != "all":
        q = q.where(User.role == role)
    rows = (await db.execute(q)).all()
    return {
        "role": role,
        "districts": [
            {"district": d, "user_count": int(c)} for d, c in rows
        ],
    }


async def _tool_active_ads(db: AsyncSession, args: dict) -> dict:
    limit = max(1, min(int(args.get("limit", 10)), 25))
    now_utc = func.now()
    rows = (
        await db.execute(
            select(Advertisement)
            .where(
                Advertisement.is_active.is_(True),
                Advertisement.starts_at <= now_utc,
                Advertisement.ends_at >= now_utc,
            )
            .order_by(Advertisement.display_order, Advertisement.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return {
        "ads": [
            {
                "id": str(a.id),
                "title": a.title,
                "advertiser": a.advertiser_name,
                "impressions": int(a.impression_count or 0),
                "clicks": int(a.click_count or 0),
                "ends_at": a.ends_at.isoformat() if a.ends_at else None,
            }
            for a in rows
        ]
    }


_TOOL_DISPATCH = {
    "get_platform_overview": _tool_platform_overview,
    "get_user_stats": _tool_user_stats,
    "get_listing_stats": _tool_listing_stats,
    "get_match_stats": _tool_match_stats,
    "get_district_breakdown": _tool_district_breakdown,
    "get_active_ads": _tool_active_ads,
}


async def _execute_tool(name: str, args: dict, db: AsyncSession) -> Any:
    impl = _TOOL_DISPATCH.get(name)
    if impl is None:
        return {"error": f"unknown_tool: {name}"}
    try:
        return await impl(db, args)
    except Exception as exc:  # noqa: BLE001 — surface error to model, not user
        logger.exception("ai_query_tool_error", tool=name, args=args)
        return {"error": "tool_execution_failed", "detail": str(exc)[:300]}


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------


async def _enforce_rate_limit(redis: aioredis.Redis, admin_id: UUID) -> None:
    key = f"admin_ai_query:{admin_id}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 3600)
    if count > RATE_LIMIT_PER_HOUR:
        ttl = await redis.ttl(key)
        raise ValidationError(
            detail=(
                f"Rate limit reached: {RATE_LIMIT_PER_HOUR} AI queries per hour. "
                f"Retry in {max(ttl, 0)} seconds."
            )
        )


# ---------------------------------------------------------------------------
# Public entrypoint
# ---------------------------------------------------------------------------


async def answer_admin_query(
    db: AsyncSession,
    redis: aioredis.Redis,
    admin_id: UUID,
    query: str,
) -> dict[str, Any]:
    """Execute one admin AI query. Returns {"answer": str, "tool_calls": [...]}."""
    q = (query or "").strip()
    if len(q) < MIN_QUERY_LEN or len(q) > MAX_QUERY_LEN:
        raise ValidationError(
            detail=f"Query must be between {MIN_QUERY_LEN} and {MAX_QUERY_LEN} characters."
        )

    if not settings.OPENROUTER_API_KEY:
        raise ExternalServiceError(
            detail="OPENROUTER_API_KEY is not configured on the server."
        )

    await _enforce_rate_limit(redis, admin_id)

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": q},
    ]
    tool_call_log: list[dict[str, Any]] = []
    started = time.monotonic()

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://spices.govihublk.com/admin",
        "X-Title": "GoviHub Admin Intelligence",
    }
    url = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/chat/completions"

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        for iteration in range(MAX_ITERATIONS):
            model = settings.ADMIN_AI_MODEL or settings.OPENROUTER_MODEL
            payload = {
                "model": model,
                "messages": messages,
                "tools": TOOLS,
                "tool_choice": "auto",
                "temperature": 0.2,
            }
            try:
                resp = await client.post(url, headers=headers, json=payload)
            except httpx.HTTPError as exc:
                logger.error("ai_query_http_error", error=str(exc))
                raise ExternalServiceError(
                    detail="OpenRouter request failed."
                ) from exc

            if resp.status_code >= 400:
                logger.error(
                    "ai_query_openrouter_error",
                    status=resp.status_code,
                    body=resp.text[:500],
                )
                raise ExternalServiceError(
                    detail=f"OpenRouter returned HTTP {resp.status_code}."
                )

            data = resp.json()
            choice = (data.get("choices") or [{}])[0]
            msg = choice.get("message") or {}
            tool_calls = msg.get("tool_calls") or []

            if not tool_calls:
                # Final answer
                logger.info(
                    "ai_query_complete",
                    admin_id=str(admin_id),
                    iterations=iteration + 1,
                    tool_calls=len(tool_call_log),
                    elapsed_ms=int((time.monotonic() - started) * 1000),
                )
                return {
                    "answer": msg.get("content") or "(no answer)",
                    "tool_calls": tool_call_log,
                    "iterations": iteration + 1,
                }

            # Carry assistant message with tool_calls back into context.
            messages.append(
                {
                    "role": "assistant",
                    "content": msg.get("content") or "",
                    "tool_calls": tool_calls,
                }
            )

            for tc in tool_calls:
                fn = (tc.get("function") or {})
                name = fn.get("name") or ""
                raw_args = fn.get("arguments") or "{}"
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                except json.JSONDecodeError:
                    args = {}
                result = await _execute_tool(name, args, db)
                tool_call_log.append({"name": name, "args": args})
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.get("id"),
                        "name": name,
                        "content": json.dumps(result, default=str),
                    }
                )

        # Out of iterations.
        logger.warning(
            "ai_query_iteration_exhausted",
            admin_id=str(admin_id),
            tool_calls=len(tool_call_log),
        )
        return {
            "answer": (
                "I needed more steps than my tool budget allows. "
                "Try a more focused question."
            ),
            "tool_calls": tool_call_log,
            "iterations": MAX_ITERATIONS,
        }
