# Dry Run: Test Account Cleanup

**DB:** `govihub_spices` @ `govihub-mumbai:5435`
**Date:** 2026-04-17
**Status:** DRY RUN ONLY — no changes made. **AWAITING NUWAN'S APPROVAL.**

---

## Summary of what deletion would remove

| Category | Would be removed | Current total | % removed |
|---|---|---|---|
| **users** | 18 | 37 | 49% |
| **harvest_listings** | 9 | 11 | 82% |
| **demand_postings** | 8 | 8 | **100%** |
| **matches** | 23 | 23 | **100%** |
| **supply_listings** | 1 | 1 | **100%** |
| **weather_alerts** | 24 | 24 | **100%** |
| **farmer_crop_selections** | 4 | 4 | **100%** |
| **advisory_questions** | 7 | 27 | 26% |
| **crop_diagnoses** | 0 | 0 | — |
| **beta_feedback** | 0 | 1 | 0% |
| **farmer_profiles** | 8 | — | — |
| **buyer_profiles** | 8 | — | — |
| **supplier_profiles** | 2 | — | — |
| **notification_preferences** | 4 | — | — |
| **ad_events** | 3 | 538 | 0.6% |
| **R2 objects** | 0 | 2 | 0% (see orphan sweep) |

After deletion of the 18 proposed test accounts, expected state:
- Users: 19 (3 admins + 16 real/ambiguous)
- Harvest listings: 2 (both by `spiceicon2026@beta.govihub.lk` — see Section C)
- Demand postings: 0
- Matches: 0
- Supply listings: 0
- Weather alerts: 0
- Advisory questions: 20

**R2 bucket:** 2 orphan diagnosis images remain (they predate everything and are not linked to any DB row). Orphan sweep in Part 4.4 will flag them.

---

## Section A — Confirmed test accounts (18) — RECOMMENDED FOR DELETION

All 18 match at least one test signal (email contains `test`/`rt`/`ginger`/`weather`/`example.com`/`deploy`/`sup_test`, or name is clearly a placeholder, or is the `govihub.ai@gmail.com` dev triad).

### Farmers (8)

**1. `govihub.ai@gmail.com` — Nuwan Farmer**
- id: `f0bc6ee6-17a6-4e16-9673-e9c028b23b5e`
- role: farmer, created: 2026-04-09 00:44:59
- why: developer test account (govihub.ai@gmail.com triad)
- harvest_listings (2): `2ac3a108-bcde-4743-b0c6-66265d22d039` (Ginger 100kg planned), `f69dd377-044b-46b4-8d80-027e2e8dd1a9` (Black Pepper 200kg planned)
- matches (1): `e5612110-c79e-409c-a95a-64dec023035d` (completed — self-match with Nuwan buyer)
- advisory_questions: 7
- weather_alerts: 6
- farmer_crop_selections: 2

**2. `rtfarm_1775714005@beta.govihub.lk` — RT Test Farmer**
- id: `142172c1-377b-4cb2-af42-18418a5d686a`, created: 2026-04-09 05:53:25
- why: `RT` prefix + unix-timestamp suffix = realtime-test seed
- zero activity

**3. `test@example.com` — Test Farmer**
- id: `0d873000-21bd-41b2-aa36-3b91ccd343b7`, created: 2026-04-09 05:55:12
- why: textbook test email + test name
- harvest_listings (1): `0c68908a-c7d1-47d3-aa18-598e2dab5009` (Black Pepper 500kg ready)
- matches (4): `f489dcad-...`, `a1f1424f-...`, `546b3c3c-...`, `55cda51e-...`

**4. `rtf3_1775714171@beta.govihub.lk` — RT Farmer 3**
- id: `902c60af-b5bc-4adb-b950-19f92e11f2fb`, created: 2026-04-09 05:56:11
- why: `RT` prefix
- harvest_listings (1): `12de2d9b-1fea-44ce-8fcd-d48f2074c8c9` (Black Pepper 500kg ready)
- matches (4): `11d04421-...`, `6b13a134-...`, `779e2a70-...`, `5ad825e0-...`

**5. `rtf5_1775714204@beta.govihub.lk` — RT Farmer 5**
- id: `4c04b475-7029-4bb8-ad9b-4549021d373b`, created: 2026-04-09 05:56:44
- why: `RT` prefix
- harvest_listings (3): `f7c40f27-...` (Black Pepper 500kg), `f444b0ff-...` (Turmeric 400kg), `7f5b2394-...` (Black Pepper 100kg)
- matches (9): `f02ba1a6`, `27aa244d`, `679eda29`, `6ef074d5`, `7dccf448`, `07e3738a`, `06c39a29`, `b99cde7b`, `c4b32955`

**6. `testfarmer_deploy@beta.govihub.lk` — Test Farmer Deploy**
- id: `e0b8165f-01c2-4da5-a132-c3c9f3458571`, created: 2026-04-09 06:11:45
- why: `testfarmer_deploy` — clearly a deploy smoke-test account
- harvest_listings (1): `6268f8b5-43fd-45bd-84c4-a0db58271e92` (Black Pepper 200kg ready)
- matches (4): `7a442373`, `b4595128`, `1111922b`, `536b9b19`

**7. `ginger_farmer@beta.govihub.lk` — Ginger Farmer**
- id: `ae6b5821-ab9d-4905-a094-bf261fd7ff49`, created: 2026-04-09 06:37:07
- why: placeholder name `Ginger Farmer`
- harvest_listings (1): `3d335460-77ea-4a31-b6f5-54fa813dfefe` (Ginger 100kg ready)
- matches (1): `7fe1e40e-180f-4b1b-82d4-093e750533c2` (completed, self-match with govihub.ai buyer)

**8. `weathertest2@beta.govihub.lk` — Weather Test**
- id: `6bfcb9e4-7bc4-4d88-91c0-3e7e1bdca96a`, created: 2026-04-11 03:21:40
- why: name `Weather Test`
- weather_alerts: 18 (heaviest weather-alerts user — clearly a test harness)
- farmer_crop_selections: 2

### Buyers (8)

**9. `govihub.ai@gmail.com` — nuwan buyer**
- id: `e8804dd7-34c1-4efa-95f9-f632bc4c36fe`, created: 2026-04-09 00:49:35
- why: dev triad
- demand_postings (1): `92f30afd-...` (Ginger 100kg fulfilled)
- matches (2): `e5612110-...` (with Nuwan Farmer), `7fe1e40e-...` (with Ginger Farmer)

**10. `rtbuy_1775714032@beta.govihub.lk` — RT Buyer 1775714032**
- id: `84adf8e3-abae-4a66-8780-82665150e5f2`, created: 2026-04-09 05:53:53
- why: `RT` prefix
- zero activity

**11. `rtb_1775714112@beta.govihub.lk` — RT Buyer**
- id: `6523f790-68b0-4a56-910c-1073ac17023b`, created: 2026-04-09 05:55:12
- why: `RT` prefix
- demand_postings (1): `ac1ce52b-17fc-4bf4-a9f4-5a3045a046f6` (Black Pepper 300kg open)
- matches (5)

**12. `rtb3_1775714171@beta.govihub.lk` — RT Buyer 3**
- id: `93d0b612-b7b9-4ba1-b40b-126b24d853f0`, created: 2026-04-09 05:56:11
- demand_postings (1): `5b16826d-...` (Black Pepper 300kg open)
- matches (5)

**13. `rtb5_1775714204@beta.govihub.lk` — RT Buyer 5**
- id: `83694e6a-01d9-49d2-9838-01f4c136d759`, created: 2026-04-09 05:56:45
- demand_postings (2): `d61bd4d7-...` (Black Pepper 300kg open), `357ecb69-...` (Turmeric 200kg open)
- matches (6)

**14. `rtb6_1775714204@beta.govihub.lk` — Buyer NoOverlap**
- id: `3c50380c-c5f7-4126-8a94-3fec8ca05866`, created: 2026-04-09 05:56:45
- why: `RT` prefix, name `NoOverlap` = test scenario
- demand_postings (1): `f29b0153-...` (Black Pepper 50kg open)
- matches (5)

**15. `testbuyer_deploy@beta.govihub.lk` — Test Buyer Deploy**
- id: `f97ae9be-2663-4c53-b738-b8c9c7ff3523`, created: 2026-04-09 06:12:44
- demand_postings (1): `6d1ca328-...` (Black Pepper 150kg open)
- no matches

**16. `ginger_buyer@beta.govihub.lk` — Ginger Buyer**
- id: `2e07d78e-7e0e-4715-bbde-8b09a244bd2e`, created: 2026-04-09 06:37:07
- why: placeholder name
- demand_postings (1): `5e509417-...` (Ginger 100kg open)

### Suppliers (2)

**17. `govihub.ai@gmail.com` — Nuwan Supplier**
- id: `c8d0643b-b374-4dee-bddb-cf3bb9c7a0d5`, created: 2026-04-09 00:52:18
- supply_listings (1) — the only supply listing in DB

**18. `sup_test_1775696344326@beta.govihub.lk` — Test Supplier**
- id: `40443449-ea8a-4107-9765-345d8555a838`, created: 2026-04-09 00:59:05
- why: `sup_test_` prefix
- zero activity

---

## Section B — NOT PROPOSED for deletion (but flagging for your review)

### B1. Real users — KEEP by default (14)

Real-looking Sinhala names, beta.govihub.lk emails minted by Gamini's onboarding, no test markers. Include the 2 **inactive** ones whose `is_active=FALSE` status caused the original stats bug.

| Email | Role | Name | Activity | Notes |
|---|---|---|---|---|
| gaminipemasiri@beta.govihub.lk | farmer | Gamini Watagoda | 0 | |
| sabar@beta.govihub.lk | farmer | Mohamed Ifham sabar | 0 | |
| jayasundara@beta.govihub.lk | farmer | Upendrika | 0 | |
| rohithat@beta.govihub.lk | farmer | Rohitha Thilakaratne | 0 | |
| palitha@beta.govihub.lk | farmer | Palitha Baddegama | 0 | |
| deshan@beta.govihub.lk | farmer | Deshan Fernando | 0 | |
| chandanads@beta.govihub.lk | farmer | Chandana de Silva | 0 | |
| chefcarlo@beta.govihub.lk | farmer | Carlo Fernando | 1 feedback | |
| kasundp@beta.govihub.lk | farmer | Kasun Deshapriya | 1 advisory | **is_active=FALSE** |
| nishantha@beta.govihub.lk | buyer | Nammuni kankanamge Nishantha | 0 | |
| dilsha_gunarathna_2001@beta.govihub.lk | supplier | N.Dilsha Ravihari Gunarathna | 0 | |
| mohan@beta.govihub.lk | supplier | Amila | 0 | **is_active=FALSE**; email/name mismatch |

### B2. Ambiguous — need your decision (4)

These look suspicious enough to mention but don't meet the test-signal bar. **Please tell me per-row: keep or delete.**

| # | Email | Role | Name | Activity | Reason to flag |
|---|---|---|---|---|---|
| B2a | `spiceicon2026@beta.govihub.lk` | farmer | Nuwan Abeysiriwardana | 2 harvest listings (Cinnamon 100kg + 30kg) | Different surname from admin `nuwan@spices` (Samaranayake) — possibly a dev/seed farmer account; owns the only non-test harvest listings |
| B2b | `spiceicon@beta.govihub.lk` | supplier | Spice Icon | 0 | Company-shaped placeholder name, no activity |
| B2c | `rajinda123@beta.govihub.lk` | farmer | Rajinda Koswatta | 0 | Duplicate name with B2d, lower-number email suffix, zero activity |
| B2d | `rajinda1234@beta.govihub.lk` | farmer | Rajinda Koswatta | 6 advisory questions | Same name as B2c. Two accounts for one farmer — merge/keep B2d, delete B2c? Or is one fake? |

### B3. Admins — PRESERVE ALWAYS (3)

| Email | Name |
|---|---|
| nuwan@spices.govihublk.com | Nuwan Samaranayake |
| gaminip@spices.govihublk.com | Gamini P |
| aruniapsara@spices.govihublk.com | Aruni Apsara |

---

## Section C — Data that stays behind after deletion (verify with you)

If we delete only Section A (18 accounts), this remains:

**Users:** 19 (3 admins + 14 real from B1 + 2 ambiguous suppliers in B2 + 0 farmers in B2 unless you spare them)

- `spiceicon2026` (B2a): **contains the only non-test harvest listings in the DB** (2 Cinnamon listings). If you delete B2a, total harvest listings drops from 11 → 0. If you keep B2a, it stays at 2.
- Ads and ad_events: unchanged (3 ads, 535 ad_events remain after removing the 3 belonging to test users)
- Knowledge chunks: unchanged (595)
- beta_feedback: 1 entry (chefcarlo)
- advisory_questions: 20 (13 from admin Nuwan, 6 from rajinda1234, 1 from kasundp)

---

## Per-user deletion order (single transaction each)

Per spec Part 4.2. Order validated against foreign keys:

1. `ad_events` WHERE user_id = $uid
2. `matches` via `harvest_listings.farmer_id = $uid` AND via `demand_postings.buyer_id = $uid` (CASCADE deletes when parent harvest/demand is deleted, but we'll delete matches explicitly first for audit log clarity)
3. `harvest_listings` WHERE farmer_id = $uid
4. `demand_postings` WHERE buyer_id = $uid
5. `supply_listings` WHERE supplier_id = $uid
6. `crop_diagnoses` WHERE user_id = $uid (capture R2 URLs before delete — currently zero rows in this table)
7. `advisory_questions` WHERE user_id = $uid
8. `beta_feedback` WHERE user_id = $uid
9. `weather_alerts` WHERE user_id = $uid
10. `farmer_crop_selections` WHERE user_id = $uid
11. `notification_preferences` WHERE user_id = $uid
12. `notifications` WHERE user_id = $uid
13. `refresh_tokens` WHERE user_id = $uid
14. `google_accounts` WHERE user_id = $uid
15. `farmer_profiles` / `buyer_profiles` / `supplier_profiles` WHERE user_id = $uid
16. `users` WHERE id = $uid

R2 deletions performed after each transaction commits (currently no per-user R2 keys — only 2 orphan diagnosis images in the whole bucket).

---

## Your decision needed

Please reply with one of:

**Option 1 — "Delete A only":** the 18 in Section A. Safe, conservative.

**Option 2 — "Delete A plus [list]":** e.g. `Delete A plus B2a, B2b, B2c` — you pick which ambiguous accounts to include.

**Option 3 — "Delete A plus all of B2":** remove all 4 ambiguous accounts. Leaves 15 users (3 admin + 12 real from B1).

**Option 4 — "Hold" or "Revise":** tell me what's wrong with the list.

---

## What does NOT get touched (ever, per spec)

- `knowledge_chunks` (595 rows — RAG store)
- `advertisements` (3 rows — DevPro / Premium Fertilizer / GoviHub App)
- R2 objects under `ads/` (none exist anyway)
- admin users
