# Report 16 — Status Enum Reconciliation

## Status: READY

## What Was Done
Reconciled all listing and demand status enum values across the entire codebase to match the architecture document.

## Changes Summary

### Harvest Listing Statuses
| Old | New | Notes |
|-----|-----|-------|
| draft | planned | Farmer listed future harvest |
| active | ready | Available for matching |
| sold | fulfilled | Transaction completed |
| matched | matched | Unchanged |
| expired | expired | Unchanged |
| cancelled | cancelled | Unchanged |

### Demand Posting Statuses
| Old | New | Notes |
|-----|-----|-------|
| draft | open | Buyer accepting matches |
| active | open | Merged with draft |
| matched | reviewing | Buyer evaluating matches |
| (new) | confirmed | Buyer confirmed a match |
| fulfilled | fulfilled | Unchanged |
| (new) | closed | Buyer manually closed |
| expired | expired | Unchanged |
| cancelled | cancelled | Unchanged |

### Match Statuses — NO CHANGES (already correct)

## Files Modified

### Backend (10 files modified, 1 created)
- `migrations/versions/002_reconcile_status_enums.py` — NEW: data migration + enum type recreation
- `app/listings/models.py` — ListingStatus→HarvestStatus, DemandStatus updated with new values
- `app/listings/schemas.py` — Updated valid status values in docstrings
- `app/listings/service.py` — Transition maps, browse filters, create defaults, delete guards
- `app/listings/router.py` — Removed hardcoded status filters
- `app/matching/engine.py` — Hard filters: 'active'→'ready' (harvest), 'active'→'open' (demand)
- `app/matching/service.py` — Added cascade helpers for status propagation
- `app/admin/service.py` — Dashboard stats queries updated
- `app/mcp/tools.py` — search_listings and platform_stats queries updated
- `scripts/scheduler.py` — Expire task queries updated

### Frontend (11 files modified)
- `src/components/ui/StatusBadge.tsx` — Full status-to-color mapping updated
- `src/messages/en.json` — Status translations added/updated
- `src/messages/si.json` — Sinhala status translations
- `src/messages/ta.json` — Tamil placeholder status translations
- `src/app/[locale]/farmer/listings/page.tsx` — Tabs: planned/ready/fulfilled
- `src/app/[locale]/buyer/demands/page.tsx` — Tabs: open/reviewing/confirmed/closed
- `src/app/[locale]/farmer/matches/page.tsx` — Match status types updated
- `src/app/[locale]/buyer/matches/page.tsx` — Match status types updated
- `src/app/[locale]/buyer/dashboard/page.tsx` — Pipeline labels updated
- `src/app/[locale]/admin/matches/page.tsx` — Status filter options updated
- `src/app/[locale]/admin/dashboard/page.tsx` — Status references checked

### Tests (3 files modified)
- `tests/conftest.py` — Factory fixtures: HarvestStatus.ready, DemandStatus.open
- `tests/test_listings.py` — All assertions updated to new enum values
- (test_matching.py, test_admin.py, test_mcp.py — no changes needed)

## Verification Results
1. `grep -rn "'draft'" govihub-api/app/ --include="*.py"` — **0 results** (clean)
2. `grep -rn "'sold'" govihub-api/app/ --include="*.py"` — **0 results** (clean)
3. `grep -rn "'active'" govihub-api/app/` in listing/demand context — **0 results** (only SupplyStatus.active remains, which is correct)
4. `grep -rn "'draft'" govihub-web/src/ --include="*.tsx"` — **0 results** (clean)
5. `grep -rn "'sold'" govihub-web/src/ --include="*.tsx"` — **0 results** (clean)
6. Migration file 002 exists with upgrade and downgrade
7. Models reflect architecture document exactly

## Issues Encountered
None.

## Ready for Next Steps
YES — Commit and push to remote.
