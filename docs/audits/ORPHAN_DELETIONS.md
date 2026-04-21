# R2 Orphan Deletions

**Date:** 2026-04-17
**Bucket:** `govihubspices`

## Summary

- R2 objects before archive uploads + purge: 2 (both orphan diagnosis images from 2026-04-07)
- After Part 2 archive uploads: 4 total
- After Part 4 orphan purge: 2 (both archives/, orphans removed)
- Bytes reclaimed by purge: 308

## Deleted keys (orphans, not under `archives/` or `ads/`)

- `diagnoses/8773a592-ac64-47f6-9fad-e399a977dc00.jpg` (154 bytes)
- `diagnoses/af2d1aa7-9c70-4270-a680-bde1c3a8c209.jpg` (154 bytes)

Both were 154-byte test images predating any DB `crop_diagnoses` row. `crop_diagnoses` table is empty at cleanup time, so these were confirmed orphans.

## Final bucket contents

- `archives/pre-production-cleanup/archived_advisory_qa.jsonl` (16531 bytes — 7 rows from doomed users)
- `archives/pre-production-cleanup/archived_feedback.jsonl` (449 bytes — 1 row from chefcarlo)

## Referenced-keys source

The reference set was built from these columns:
- `users.avatar_url`
- `advertisements.image_url` (paths like `/uploads/ads/seed-*.jpg` — local filesystem fallback, not R2)
- `advertisements.click_url` (external link targets, not R2)
- `crop_diagnoses.image_url` (empty table)
- `harvest_listings.images[]` (JSONB array — all harvest_listings were deleted in Part 3; zero rows now)

No user, listing, or diagnosis currently references any R2 key. The `ads/` prefix is preserved by rule even though no DB row currently points into it.

## Preserved prefixes

- `archives/` — never deleted (Part 2 + Part 8 archives live here)
- `ads/` — never deleted (ad production images per spec)
