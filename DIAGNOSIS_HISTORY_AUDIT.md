# DIAGNOSIS_HISTORY_AUDIT.md — Phase 0 Audit

**Date:** 2026-07-14
**Symptom:** Diagnosis › History cards all show "විශ්ලේෂණය අසාර්ථකයි / Analysis failed" while still rendering a real confidence % (65/88/80/80…).
**MCP/DB truth:** all diagnoses SUCCEEDED (13 records, all `completed`, avg conf ~0.75). So this is a **display bug**, not a pipeline failure.

## Verdict: H1 confirmed (list serializer field mismatch) — NOT H2/H3/H4

### 0.1 What the API returns
`GET /api/v1/diagnosis/history` → `PaginatedResponse{ data: DiagnosisBrief[], meta }` (`router.py:96-122`).
`DiagnosisBrief` (`schemas.py:10-19`) = `{ id, disease_name, confidence, image_url, created_at }` — snake_case, and **no `status` field**. The detail schema `DiagnosisResponse` *does* include `status`.

### 0.2 What the DB holds (prod `crop_diagnoses`)
Status enum (`diagnosis/models.py:13-17`): `pending, processing, completed, failed`.
- 13 rows, **all `completed`**; 12 have a `disease_name`, 1 completed row has NULL name.
- Recent names/confidence match the on-screen %: "Leaf Blotch (Taphrina maculans)" 0.88, "Leaf Spot…" 0.80, "Bacterial Wilt…" 0.65 — all `completed`.

### 0.3 What the card read
`farmer/diagnosis/page.tsx`:
- Fetch (`:59-62`) uses the correct `api.get("/diagnosis/history")` (H4 ruled out — no URL double-prefix) and sets items **directly** (`res.data`), no field mapping.
- `HistoryItem` type (`:31-37`) declared **`disease`**, `imageUrl`, `date` (camelCase) — none of which exist on the API item (`disease_name`, `image_url`, `created_at`).
- Card (`:362`): `{item.disease || "…Analysis failed"}` — `item.disease` is **always undefined** → the fallback fires for every record. `{item.confidence}` matches → the % renders. This exactly reproduces the symptom.

### 0.4 Root cause
The list card read the wrong field name (`disease` vs API `disease_name`), so the title was always empty and fell back to a hardcoded failure string; confidence rendered unconditionally. The serializer also omitted `status`, so the card could not tell a genuine failure from a success. **No record ever actually failed.**

## Fix (at the source)
1. **Backend:** `DiagnosisBrief` + `_to_brief` now return `status` (parity with the detail serializer). `docs/api/diagnosis-history.md` records the contract + the scientific-name display decision.
2. **Frontend:** `HistoryItem` uses the real API fields (`disease_name`, `confidence`, `status`, `created_at`). Title = real disease name, truncated to 60 chars. Failure text (+ retry hint, and **no** confidence %) only when `status === 'failed'`. A completed record with no name shows "No disease detected" (the AI found no disease). Date now renders from `created_at`.
3. **Copy:** `analysisFailed`, `retryHint`, `noDiseaseDetected` added in EN/SI/TA (gemini-translate). Scientific/disease names stay English in all locales per the display decision (Latin names must not be machine-translated).

## Corrections to the handoff doc
- None material — the doc's H1 was correct. H4 (URL double-prefix) was explicitly ruled out: the history fetch uses the `lib/api.ts` convention correctly. The one nuance the doc didn't anticipate: the list serializer also lacked `status`, so fixing the field name alone would still leave failed records indistinguishable — hence the backend change.

## Tests
`tests/test_diagnosis_history.py` — asserts the list exposes `disease_name` + `confidence` + `status`, a completed record carries its real name/confidence, and a failed record is distinguishable with a null name. Green against real Postgres (`govihub_test`).
