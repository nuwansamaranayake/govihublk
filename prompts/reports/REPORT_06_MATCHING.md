# REPORT 06 — Matching Engine

**Date:** 2026-03-23
**Prompt:** 06 — Matching Engine
**Status:** Complete

---

## Files Created / Modified

| Path | Action |
|------|--------|
| `govihub-api/app/matching/schemas.py` | Created |
| `govihub-api/app/matching/engine.py` | Created |
| `govihub-api/app/matching/tasks.py` | Created |
| `govihub-api/app/matching/service.py` | Created |
| `govihub-api/app/matching/router.py` | Created |
| `govihub-api/app/main.py` | Modified — matching router registered |

---

## 1. Schemas (`schemas.py`)

| Schema | Purpose |
|--------|---------|
| `MatchScoreBreakdown` | Per-component scores + distance_km |
| `MatchRead` | Full match detail (score_breakdown, timestamps, notes) |
| `MatchBrief` | Lightweight summary for list views |
| `MatchListFilter` | Query-param filter model (not bound to router directly, documents accepted filters) |
| `MatchAcceptRequest` | Optional price/qty negotiation + notes |
| `MatchRejectRequest` | Optional notes |
| `MatchConfirmRequest` | Required final price + qty |
| `MatchFulfillRequest` | Optional fulfilment notes |
| `MatchDisputeRequest` | Required dispute description (min 10 chars) |

---

## 2. Matching Engine (`engine.py`)

### Weights
```
distance    0.35
quantity    0.25
date_overlap 0.25
freshness   0.15
```

### `find_matches_for_demand(demand_id)`
- Executes raw SQL with `ST_DWithin` (PostGIS Geography, metres) to filter harvest listings within `demand.radius_km` (default 200 km).
- Filters: same `crop_id`, `status = 'active'` on both sides, `available_until >= CURRENT_DATE`.
- Scores each candidate, returns top 10 sorted by descending score.

### `find_matches_for_harvest(harvest_id)`
- Mirror of the above: queries active demand postings within each demand's own `radius_km`.
- Uses `ST_DWithin` with `COALESCE(dp.radius_km, 200) * 1000` metres.

### `compute_match_score` / `_compute_score`
- **Distance score:** `1 - (km / 300)`, clamped to [0,1]. Neutral (0.5) when no geo data.
- **Quantity score:** `min(h_qty, d_qty) / max(h_qty, d_qty)` — penalises over/under supply.
- **Date overlap score:** Computes overlap days between harvest availability window and demand's needed-by date; 0.7 when dates unknown.
- **Freshness score:** Exponential decay `exp(-age_days / 30)`.

### `suggest_farmer_cluster(demand_id)`
- Groups nearby farmers by `farmer_id`, sums `quantity_kg`.
- Returns groups where combined supply >= demand quantity, ordered by average distance.

---

## 3. Background Tasks (`tasks.py`)

### `run_matching_for_new_listing(listing_type, listing_id)`
- Opens its own `async_session_factory` session (safe to call outside request lifecycle).
- Delegates to engine (`find_matches_for_demand` or `find_matches_for_harvest`).
- Creates `Match` records for candidates with `score >= 0.30` (SCORE_THRESHOLD).
- Skips existing pairs (checks before insert; also handles `IntegrityError` race condition).
- Returns count of newly created Match rows.

---

## 4. Service (`service.py`)

### Role-based scoping in `list_matches`
- **farmer** → only sees matches whose `harvest_id` belongs to their listings.
- **buyer** → only sees matches whose `demand_id` belongs to their postings.
- **admin** → sees all matches.

### State machine
```
proposed
  ├─ farmer accepts ──► accepted_farmer
  │     └─ buyer accepts ──► confirmed
  └─ buyer accepts ──► accepted_buyer
        └─ farmer accepts ──► confirmed

confirmed / in_transit ──► fulfilled
confirmed / in_transit / fulfilled ──► disputed
any non-terminal ──► cancelled
```

All transitions enforce the above rules via `ValidationError` on illegal moves.

### Methods
| Method | Transition |
|--------|-----------|
| `accept_match` | proposed→accepted_farmer/buyer or cross-accept→confirmed |
| `reject_match` | any non-terminal → cancelled |
| `confirm_match` | proposed/accepted_* → confirmed (admin / explicit) |
| `fulfill_match` | confirmed/in_transit → fulfilled |
| `dispute_match` | confirmed/in_transit/fulfilled → disputed |

---

## 5. Router (`router.py`)

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/v1/matches` | List matches (role-scoped) |
| GET | `/api/v1/matches/{id}` | Match detail |
| POST | `/api/v1/matches/{id}/accept` | Accept + optional negotiation |
| POST | `/api/v1/matches/{id}/reject` | Reject / cancel |
| POST | `/api/v1/matches/{id}/confirm` | Force-confirm with price+qty |
| PATCH | `/api/v1/matches/{id}/fulfill` | Mark fulfilled |
| PATCH | `/api/v1/matches/{id}/dispute` | Raise dispute |

All endpoints require `get_current_active_user`.

---

## 6. `main.py` Changes

```python
from app.matching.router import router as matching_router
app.include_router(matching_router, prefix="/api/v1/matches", tags=["Matching"])
```

The commented-out line `# app.include_router(matching_router, ...)` has been replaced with a live registration.

---

## Design Decisions

- **Raw SQL for PostGIS**: SQLAlchemy ORM does not natively support `ST_DWithin` on Geography columns without GeoAlchemy2 spatial functions. Raw `text()` queries avoid ambiguity and are more maintainable for spatial logic.
- **Async-safe tasks**: `run_matching_for_new_listing` opens its own session, making it safe for ARQ, Celery, or FastAPI `BackgroundTasks`.
- **SCORE_THRESHOLD = 0.30**: Filters out weak matches before persisting, keeping the Match table focused on actionable pairs.
- **UniqueConstraint on (harvest_id, demand_id)**: Prevents duplicate matches; the task handles `IntegrityError` gracefully for concurrent runs.
