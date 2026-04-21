# CLEANUP_AUDIT.md — Spices Production Cleanup, Part 1

**Environment:** `govihub-mumbai` (187.127.135.82), `docker-compose.spices.yml`, DB `govihub_spices`.
**Date:** 2026-04-17

## Root Cause — One Sentence

`get_platform_stats` applies `WHERE is_active = TRUE` to the user count; `govihub_get_platform_stats` has no such filter — the 2 inactive users (Kasun Deshapriya / farmer, Amila / supplier) produce the 35 vs 37 gap.

---

## 1.1 Live containers on VPS

```
NAMES                                 STATUS                 PORTS
govihub-spices-govihub-api-spices-1   Up 5 days              0.0.0.0:8003->8000/tcp
govihub-spices-govihub-web-spices-1   Up 5 days              0.0.0.0:3003->3000/tcp
govihub-spices-postgres-spices-1      Up 9 days (healthy)    0.0.0.0:5435->5432/tcp
govihub-spices-redis-spices-1         Up 10 days (healthy)   0.0.0.0:6382->6379/tcp
```

All 4 healthy. No govihub containers on local machine.

## 1.2 Database state (govihub_spices on port 5435)

### Users

```
 role    | count
---------+-------
 farmer  |   20
 buyer   |    9
 supplier|    5
 admin   |    3
         =====
 total   |   37

 is_active | count
-----------+-------
 f         |    2
 t         |   35
```

The 2 inactive users are:
- `kasundp@beta.govihub.lk` — Kasun Deshapriya (farmer) — created 2026-04-12
- `mohan@beta.govihub.lk` — Amila (supplier) — created 2026-04-11

No `deleted_at` column exists on `users`. Active/inactive is the only toggle.

### Other table counts

| Table | Count | Notes |
|---|---|---|
| harvest_listings | 11 | planned=2, ready=9 |
| demand_postings | 8 | open=7, fulfilled=1 |
| matches | 23 | proposed=21, completed=2 |
| crop_diagnoses | 0 | (NB. the spec referred to this as `diagnoses` — actual table name is `crop_diagnoses`) |
| advisory_questions | 27 | |
| beta_feedback | 1 | (spec called it `feedback` — actual name is `beta_feedback`) |
| weather_alerts | 24 | |
| farmer_crop_selections | 4 | |
| ad_events | 538 | |
| advertisements | 3 | DevPro / Premium Fertilizer / GoviHub App — DO NOT TOUCH |
| supply_listings | 1 | |
| knowledge_chunks | 595 | RAG store — DO NOT TOUCH |

## 1.3 MCP tool implementations — the exact diff

**`get_platform_stats`** — `govihub-api/app/mcp/tools.py:986-1060`

```python
user_stmt = text("""
    SELECT role, COUNT(*) AS count
    FROM users
    WHERE is_active = TRUE          <-- the culprit
    GROUP BY role
""")
```

Also applied in the growth-comparison branch at `tools.py:1064-1069`.

**`govihub_get_platform_stats`** — `govihub-api/app/mcp/tools.py:1553-1612`

```python
user_stmt = text("SELECT role, COUNT(*) AS count FROM users GROUP BY role")
# No is_active filter
```

Other differences (intentional, different scope of report):
- `get_platform_stats` reports active-only listings/demand (`status IN ('planned','ready')` / `('open','reviewing')`) and recent metrics (matches this month, diagnoses this week).
- `govihub_get_platform_stats` breaks everything down by status and is all-time.

The user-count mismatch is the only real bug. The rest is legitimate scope difference.

## 1.4 Both MCP endpoints — live call via the registered spices connector

Called via Claude Code's MCP tools (not curl — per CLAUDE.md rule):

`get_platform_stats`:
```json
{"users": {"total": 35, "by_role": {"admin": 3, "buyer": 9, "farmer": 19, "supplier": 4}},
 "listings": {"active_harvest": 11, "active_demand": 7},
 "matches": {"this_month": 23},
 "diagnosis": {"this_week": 0},
 "advisory": {"questions_answered_total": 27}}
```

`govihub_get_platform_stats`:
```json
{"users": {"total": 37, "by_role": {"admin": 3, "buyer": 9, "farmer": 20, "supplier": 5}},
 "harvest_listings": {"total": 11, "by_status": {"planned": 2, "ready": 9}},
 "demand_postings": {"total": 8, "by_status": {"open": 7, "fulfilled": 1}},
 "matches": {"total": 23, "by_status": {"completed": 2, "proposed": 21}},
 "diagnoses": {"total": 0},
 "feedback": {"total": 1}}
```

Matches the DB exactly. Both tools are hitting the same DB.

## 1.5 R2 bucket `govihubspices` inventory

```
Total objects: 2
Total bytes:   308
By prefix:     {"diagnoses": 2}
```

Keys:
- `diagnoses/8773a592-ac64-47f6-9fad-e399a977dc00.jpg` — 154 B — 2026-04-07
- `diagnoses/af2d1aa7-9c70-4270-a680-bde1c3a8c209.jpg` — 154 B — 2026-04-07

Both are 154-byte test images predating every listed DB diagnosis. The `crop_diagnoses` table is currently empty (0 rows), so **both R2 objects are orphans**.

No `profile-photos/`, `listing-images/`, or `ads/` prefixes exist in the bucket. Nothing under `ads/` means no production ad images to worry about during orphan sweep.

---

## Per-user activity matrix (full 37 users)

```
  role    | is_active | count | notes
----------+-----------+-------+-----------------------
  admin   |     t     |   3   | PRESERVE ALWAYS
  farmer  |     t     |  19   | mix of real & test
  farmer  |     f     |   1   | kasundp
  buyer   |     t     |   9   | mix of real & test
  supplier|     t     |   4   | mix of real & test
  supplier|     f     |   1   | mohan
```

Full breakdown in `TEST_ACCOUNT_DRY_RUN.md`.

---

## Verdict

- **Stats discrepancy:** Path A (one tool has a bug). The `is_active = TRUE` filter on the user count in `get_platform_stats` contradicts the spec's canonical definition. Fix: remove the filter, rebuild, redeploy, re-verify both tools agree at 37.
- **Test cleanup:** Proceed to Part 3 dry run.
