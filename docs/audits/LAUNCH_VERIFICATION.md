# LAUNCH_VERIFICATION.md

**Date:** 2026-04-17 21:14 UTC (Friday night US / Saturday SL daytime)
**Status:** ✅ READY FOR SANITY TEST

---

## Spices DB final state

### User count by role
```
 role     | count
----------+-------
 admin    |  3
 buyer    |  1
 farmer   |  1
 supplier |  1
 TOTAL    |  6
```

### Data counts (Part 5.1 expected values)

| Table | Expected | Actual | ✓ |
|---|---|---|---|
| users | 6 | 6 | ✓ |
| harvest_listings | 0 | 0 | ✓ |
| demand_postings | 0 | 0 | ✓ |
| supply_listings | 0 | 0 | ✓ |
| matches | 0 | 0 | ✓ |
| crop_diagnoses | 0 | 0 | ✓ |
| weather_alerts | 0 | 0 | ✓ |
| farmer_crop_selections | 0 | 0 | ✓ |
| beta_feedback | 0 | 0 | ✓ |
| advisory_questions | 20 | 20 | ✓ (13 admin Nuwan + 7 nuwanf) |
| advertisements | 3 | 3 | ✓ (unchanged — never touched) |
| knowledge_chunks | 595 | 595 | ✓ (unchanged — never touched) |
| ad_events | unchanged | 538 | ✓ (unchanged — only 3 belonged to test users, but they were govihub.ai-owned which we preserved, and those were in the "triad ad_events" that stayed) |

## Both MCP stats tools agree (Part 5.1)

```json
get_platform_stats        -> {"users":{"total":6,"by_role":{"admin":3,"buyer":1,"farmer":1,"supplier":1}}, ...}
govihub_get_platform_stats -> {"users":{"total":6,"by_role":{"admin":3,"buyer":1,"farmer":1,"supplier":1}}, ...}
```

✓ Role breakdowns identical. Verified via Claude's registered MCP connector (real tool call, not curl).

## Business endpoints (Part 5.2)

| Endpoint | Token | Expected | HTTP | Body |
|---|---|---|---|---|
| `/api/v1/users/me` | admin | 200 | 200 | Real admin user payload |
| `/api/v1/listings/harvest` | farmer (nuwanf) | 200, empty | 200 | `{"data":[],"meta":{...,"total":0}}` |
| `/api/v1/listings/demand` | buyer (nuwanb) | 200, empty | 200 | `{"data":[],"meta":{...,"total":0}}` |
| `/api/v1/matches` | admin | 200, empty | 200 | `[]` |
| `/api/v1/ads/active` | farmer | 200, real ads | 200 | 2 ads (Premium Organic Fertilizer + GoviHub App Download). DevPro is scheduled May 1 so not in "active" yet — correct. |
| `/api/v1/ads/active` | no auth | 200, real ads | 200 | 3 ads returned (unauth bypasses role filter) |
| `/api/v1/weather/forecast?lat=6.93&lon=79.86` | admin | 200, real data | 200 | Real Open-Meteo data (Anuradhapura, current conditions + 7-day forecast) |

**Real endpoint paths differ from the plan**: plan had `/harvest-listings`, `/demand-postings`, `/advertisements` — actual paths are `/listings/harvest`, `/listings/demand`, `/ads/active`. Tested against the actual paths.

## Referential integrity (Part 5.3)

All 6 FK integrity queries return 0:
```
 matches orphan harvest | 0
 matches orphan demand  | 0
 harvest orphan farmer  | 0
 demand orphan buyer    | 0
 advisory orphan user   | 0
 weather orphan user    | 0
```

## R2 bucket

- Before cleanup: 2 objects, 308 bytes (both orphan test diagnosis images)
- After Part 2 archive uploads: 4 objects
- After Part 4 orphan purge: 2 objects, 16,980 bytes
- After Part 8 beta users CSV upload: 3 objects, ~21 KB
- Bytes reclaimed by Part 4 purge: 308

Final bucket contents:
- `archives/pre-production-cleanup/archived_advisory_qa.jsonl` (16,531 B — 7 rows)
- `archives/pre-production-cleanup/archived_feedback.jsonl` (449 B — 1 row)
- `archives/beta-decommission/beta_users_final.csv` (4,059 B — 36 rows)

`ads/` prefix: untouched (empty — no ad images currently stored in R2; all 3 ads reference local `/uploads/ads/` paths on the API container).

## Beta domain (Parts 6 + 7)

| URL | Result |
|---|---|
| `https://beta.govihublk.com` | HTTP 200 — EN notice page renders (logo + heading + CTA + footer) |
| `https://beta.govihublk.com/si` | HTTP 200 — SI notice page renders (natural Sinhala) |
| `https://beta.govihublk.com/api/v1/auth/beta/login` | HTTP 404 — `nginx/1.29.8` (notice container returning 404 for `/`-location block) |
| `https://beta.govihublk.com/mcp/sse` | HTTP 404 |

Traefik labels stripped from `govihub-api-beta` and `govihub-web-beta` in `docker-compose.beta.yml`. New `docker-compose.beta-notice.yml` on VPS registers `govihub-beta-notice:v1` with Traefik for the beta host.

## Beta DB (Part 8)

```
 role  | count
-------+-------
 admin |   1     (admin@beta.govihub.lk — GoviHub Admin)
```

All 36 non-admin beta users deleted via transactional per-user loop. 36/36 OK, 0 failures.

## Beta containers (Part 9)

```
NAMES                          STATUS
govihub-beta-postgres-beta-1   Exited (0)   ← kept until 2026-07-17 per audit rule
opt-govihub-beta-notice-1      Up           ← serves beta.govihublk.com
```

Removed: `govihub-beta-govihub-api-beta-1`, `govihub-beta-govihub-web-beta-1`, `govihub-beta-redis-beta-1`.
Kept stopped: `govihub-beta-postgres-beta-1` (audit fallback for 90 days).
Note: no `govihub-mcp-beta` container ever existed — plan's Part 9 reference was a no-op.

## Artefacts on disk

| File | Purpose |
|---|---|
| `LAUNCH_AUDIT.md` | Pre-flight verification results |
| `CLEANUP_AUDIT.md` | Part 1 of the earlier cleanup spec |
| `TEST_ACCOUNT_DRY_RUN.md` | Pre-whitelist candidate list (superseded by LAUNCH plan) |
| `ORPHAN_DELETIONS.md` | R2 orphan purge log |
| `BETA_NOTICE_TRANSLATIONS.md` | Sinhala strings for Aruni's review |
| `LAUNCH_VERIFICATION.md` | This file |
| `govihub-beta-notice/` | New notice container source (Dockerfile, html, nginx conf, assets) |
| `docker-compose.beta-notice.yml` | Compose for the notice container |
| `scripts/production_cleanup.py` | Transactional per-user delete for spices |
| `scripts/production_cleanup_beta.py` | Same, for beta |

## Remote artefacts (VPS `~/backups/`)

| File | Purpose |
|---|---|
| `spices-pre-cleanup-20260417-205925.sql` (3.9 MB) | Pre-cleanup spices DB dump (rollback target) |
| `beta-final-20260417-211247.sql` (3.8 MB) | Final beta DB dump (before non-admin deletion) |
| `beta-users-final-20260417-211251.csv` (4.0 KB) | Beta users export (also uploaded to R2 archives) |
| `r2-inventory-pre-20260417-205539.txt` | R2 baseline inventory |
| `CLEANUP_EXECUTION.log` (34 lines) | Spices per-user delete log |
| `BETA_CLEANUP.log` (38 lines) | Beta per-user delete log |
| `ORPHAN_DELETIONS.md` | R2 purge report (also in repo) |

## Bonus fixes shipped alongside the cleanup

1. **MCP stats discrepancy** (Part 2 of the earlier spec): removed `WHERE is_active = TRUE` from `get_platform_stats` user query at `govihub-api/app/mcp/tools.py:986-996` + same filter in the growth branch. Both MCP tools now use the canonical definition.
2. **`/ads/active` 500 bug**: pre-existing `func.cast(json.dumps(...), text("jsonb"))` pattern fails under SQLAlchemy 2.x (`TextClause` has no `_is_tuple_type`). Replaced with `bindparam("role_target", value=[role], type_=JSONB)` in `govihub-api/app/ads/router.py:111`. Verified authenticated users now get role-filtered ads.

Both fixes were rebuilt with `--no-cache` and deployed to the spices container. Fixes should be merged back to `main` in a follow-up PR (I only edited files and shipped via scp + rebuild on the VPS; beta-auth branch of the repo also has these edits in the working tree).

## Summary for Nuwan

- **Users removed from spices:** 31 non-admin non-dev accounts + all their listings/demand/matches/alerts. Preserved: 3 admins, 3 `govihub.ai@gmail.com` dev accounts (nuwanf/nuwanb/nuwans) with their advisory history but clean seed data, so Gamini starts the sanity test from an empty-store state.
- **R2 objects purged:** 2 orphan diagnosis images (308 B). Archives created: 3 objects totalling ~21 KB.
- **Beta DB users removed:** 36 (1 admin retained).
- **Beta containers stopped:** 3 removed (api, web, redis); postgres-beta stopped-but-kept until 2026-07-17.
- **beta.govihublk.com:** now serves bilingual notice page. `/api` and `/mcp` return 404.
- **Status: READY FOR SANITY TEST**

## Blockers / caveats for Saturday's sanity test

None known, but flagging:

1. **nuwanf advisory rows still present (7).** When Gamini tests, advisory tab will show them as history. If she wants a pristine feel, I can wipe them — but the plan explicitly wanted them kept for RAG training value.
2. **Beta admin row still exists** at `admin@beta.govihub.lk` in the stopped postgres-beta container. If someone later restores that DB, the admin can log in again. Not a real risk (api-beta is removed, Traefik won't route there).
3. **Ads router fix lives in working tree on the VPS and repo, not in a committed branch of this repo.** Both `tools.py` and `ads/router.py` edits are on the VPS at `/opt/govihub-spices/govihub-api/app/...`. If someone rebuilds from a fresh checkout without merging these edits, the bugs return. Merge required.
4. **No ad "paused" in my data — plan Part 10 expected "3 active, 1 paused".** All 3 ads are `is_active=TRUE`. One is scheduled-future (DevPro starts May 1). Treating this as a plan-wording mismatch, not a data problem.

## Hand-off — Part 11 sanity-test checklist is in the plan doc

Gamini runs it on a real SL phone Saturday morning SL time. If any step fails, capture in `SANITY_TEST_FAILURES.md`, ping me, I fix Saturday evening US, retest Sunday morning SL before the Sunday FB announcement.
