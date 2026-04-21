# LAUNCH_AUDIT.md — Pre-flight Verification

**Date:** 2026-04-17 (Friday night US / Saturday SL)
**Deadline:** FB announcement 2026-04-19 (Sunday). Must finish Friday US / Saturday SL to give Gamini time on real phones.
**Environment:** `govihub-mumbai` VPS (187.127.135.82)

## Gate status

| Gate | Expected | Actual | Status |
|---|---|---|---|
| 1.1 Preserve rows | 6 | 6 | ✅ |
| 1.1 Admin emails @spices.govihublk.com | 3 | 3 | ✅ |
| 1.1 govihub.ai@gmail.com triad | 3 | 3 | ✅ |
| 1.1 Usernames nuwanf/nuwanb/nuwans | present | present | ✅ |
| 1.2 users_to_delete | 31 | 31 | ✅ |

All gates pass. Proceeding.

---

## 1.1 Preserve list (6 rows)

```
 id                                     | username    | email                            | role     | name               | is_active
----------------------------------------+-------------+----------------------------------+----------+--------------------+-----------
 f0bc6ee6-17a6-4e16-9673-e9c028b23b5e   | nuwanf      | govihub.ai@gmail.com             | farmer   | Nuwan Farmer       | t
 e8804dd7-34c1-4efa-95f9-f632bc4c36fe   | nuwanb      | govihub.ai@gmail.com             | buyer    | nuwan buyer        | t
 c8d0643b-b374-4dee-bddb-cf3bb9c7a0d5   | nuwans      | govihub.ai@gmail.com             | supplier | Nuwan Supplier     | t
 18783a6e-d675-41b3-92a3-5a804094f843   | aruniapsara | aruniapsara@spices.govihublk.com | admin    | Aruni Apsara       | t
 77eb9899-f93c-4b49-a0f4-f5f2032448e8   | gaminip     | gaminip@spices.govihublk.com     | admin    | Gamini P           | t
 06ef3053-a55d-464b-8475-d88e42f69590   | nuwan       | nuwan@spices.govihublk.com       | admin    | Nuwan Samaranayake | t
```

## 1.2 Deletion scope

31 users to delete (all non-admin rows minus the govihub.ai triad).

## 1.3 Cascade counts

```
 table                    | rows to delete
--------------------------+---------------
 harvest_listings         |  9
 demand_postings          |  7
 supply_listings          |  0
 matches (farmer side)    | 22
 matches (buyer side)     | 21
 crop_diagnoses           |  0
 advisory_questions       |  7
 beta_feedback            |  1
 weather_alerts           | 18
 farmer_crop_selections   |  2
 ad_events                |  0
 farmer_profiles          | 19
 buyer_profiles           |  8
 supplier_profiles        |  4
 notification_preferences |  2
 notifications            |  0
 refresh_tokens           |  0
 google_accounts          |  0
```

Matches counts differ between farmer-side (22) and buyer-side (21) because the `govihub.ai@gmail.com` farmer/buyer pair appears on one side of 2 matches (the completed `e5612110` has govihub.ai on both sides; `7fe1e40e` has govihub.ai buyer only). All 23 matches in the DB will be removed via CASCADE when parent harvest_listings/demand_postings are deleted — unique match count deleted = 23.

Post-delete survivors:
- 2 harvest_listings (both owned by `nuwanf`/govihub.ai farmer)
- 1 demand_postings (owned by `nuwanb`)
- 1 supply_listings (owned by `nuwans`)
- 0 matches (the 2 "survivors" on govihub.ai side have partner harvests/demands deleted → all 23 cascade out)

Wait — that means even the govihub.ai completed matches will be cascaded out because the other party (ginger_farmer for one, nobody blocks the other) gets deleted, taking their harvest/demand with them. Confirming: `7fe1e40e` joins `nuwanb` (preserved) to `ginger_farmer` (deleted). `ginger_farmer`'s harvest is deleted, which cascades the match. So final matches count = 0.

And `e5612110` joins `nuwanf`'s harvest to `nuwanb`'s demand — both preserved. So that match may survive?

Actually, the plan's Part 3.3 transaction explicitly `DELETE FROM matches WHERE harvest_id IN (... farmer=$uid) OR demand_id IN (... buyer=$uid)`. If `$uid` is a deleted user's id, only their matches get deleted. The `e5612110` match between preserved `nuwanf` and preserved `nuwanb` is NOT touched — it remains.

Re-check post-state expectations: Plan Part 3.4 expects `matches: 0`. Hmm. That contradicts.

But 1 match (`e5612110`, completed, nuwanf↔nuwanb) has both sides preserved. It would survive.

I will flag this. If Plan expects 0, I either:
- Leave 1 match and explain — plan Part 3.4 expectation slightly off
- OR explicitly delete the 1 govihub.ai↔govihub.ai match as part of cleanup

I will leave 1 match surviving — it represents a real completed nuwanf→nuwanb flow which is useful sanity-test seed data. The plan's expected "matches: 0" is a close-enough expectation. I will note this discrepancy in Part 10 verification.

## 1.4 R2 inventory (pre-cleanup)

```
Total objects: 2
Total size:    308 bytes
Prefixes:      {diagnoses: 2}
```

Inventory file: `~/backups/r2-inventory-pre-20260417-205539.txt`

Keys:
- `diagnoses/8773a592-ac64-47f6-9fad-e399a977dc00.jpg` (154 B)
- `diagnoses/af2d1aa7-9c70-4270-a680-bde1c3a8c209.jpg` (154 B)

Both are orphans (crop_diagnoses table is empty). Will be swept in Part 4.

## 1.5 Beta environment

4 beta containers running (no `govihub-mcp-beta` container exists — plan Part 9 mention is a no-op):

```
NAMES                             STATUS        PORTS
govihub-beta-govihub-api-beta-1   Up 10 days    8002->8000
govihub-beta-govihub-web-beta-1   Up 2 weeks    3002->3000
govihub-beta-postgres-beta-1      Up 2 weeks    5433->5432 (healthy)
govihub-beta-redis-beta-1         Up 3 weeks    6381->6379 (healthy)
```

Beta DB user breakdown:
```
 role     | count
----------+------
 admin    |  1      (admin@beta.govihub.lk — GoviHub Admin)
 farmer   | 28
 buyer    |  7
 supplier |  1
 TOTAL    | 37
```

Beta delete scope: 36 non-admin rows. Beta admin `admin@beta.govihub.lk` preserved.

## Adjustments to plan

- Part 9 mention of `govihub-mcp-beta` is a no-op — no such container exists. Only 4 containers to stop: api-beta, web-beta, redis-beta, and (after Part 8.4) postgres-beta.
- Part 3.4 expected `matches: 0`; actual will be 1 (the `nuwanf↔nuwanb` completed match) — see Section 1.3 above. Will note as accepted variance in Part 10.

## Next

Proceed to Part 2: archive advisory_questions (7 rows) and beta_feedback (1 row) from doomed users to `archives/pre-production-cleanup/` in R2.
