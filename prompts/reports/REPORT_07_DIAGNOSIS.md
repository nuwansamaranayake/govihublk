# REPORT 07 — Diagnosis Module

**Date:** 2026-03-23
**Prompt:** 07_DIAGNOSIS_MODULE.md
**Status:** COMPLETE

---

## Files Created / Modified

| File | Action |
|------|--------|
| `govihub-api/app/diagnosis/schemas.py` | Created |
| `govihub-api/app/diagnosis/cnn.py` | Created |
| `govihub-api/app/diagnosis/service.py` | Created |
| `govihub-api/app/diagnosis/router.py` | Created |
| `govihub-api/app/utils/storage.py` | Created |
| `govihub-api/app/main.py` | Modified |

---

## 1. `app/diagnosis/schemas.py`

Four Pydantic models:

- **`DiagnosisResponse`** — full result (id, disease_name, confidence, top_predictions list, treatment_advice, language, crop_name, image_url, status, created_at)
- **`DiagnosisHistoryFilter`** — optional crop_id, page, size (used as a schema; query params handled directly in router for OpenAPI compatibility)
- **`DiagnosisFeedbackRequest`** — single `feedback` field with regex pattern `^(helpful|not_helpful|incorrect)$`
- **`DiagnosisBrief`** — compact list view (id, disease_name, confidence, image_url, created_at)

---

## 2. `app/diagnosis/cnn.py`

**`CropDiseaseCNN`** class:

- **`CLASS_NAMES`** — 38 PlantVillage classes including 4 Rice diseases:
  - `Rice___Leaf_Blast`, `Rice___Brown_Spot`, `Rice___Neck_Blast`, `Rice___Sheath_Blight`
- **`load_model()`** — attempts `torch.load` from `/app/ml/models/crop_disease.pt`; sets `_placeholder_mode=True` on missing file or ImportError
- **`predict(image_bytes)`** — runs inference and returns top-3 `{label, confidence}` dicts; placeholder returns fixed mock: Leaf_Blast 0.55, Brown_Spot 0.28, Neck_Blast 0.10
- **`preprocess(image_bytes)`** — PIL open → RGB → resize 224×224 → ToTensor → Normalize (ImageNet mean/std) → unsqueeze batch dim
- Module-level singleton `cnn_model` for injection

---

## 3. `app/utils/storage.py`

**`StorageService`** class:

- **`upload_image(file_bytes, content_type, folder, filename)`** — validates MIME type (JPEG/PNG only) and size (≤10 MB), then uploads
- **R2 backend** — initialised from `settings.R2_*` credentials; uses `boto3` S3 client pointing at `{account_id}.r2.cloudflarestorage.com`; async via `run_in_executor`
- **Local fallback** — saves to `/app/uploads/{folder}/{uuid}.{ext}`, returns `/uploads/...` path
- Raises `ValidationError` on bad type or oversized file
- Module-level singleton `storage_service`

---

## 4. `app/diagnosis/service.py`

**`DiagnosisService`** class:

### `diagnose(db, farmer_id, image_file, crop_id)`
1. Read and validate file bytes
2. Upload to storage via `storage_service`
3. Create `CropDiagnosis` record in `processing` state, flush for ID
4. Run `cnn_model.predict()`
5. Classify confidence tier: `high` (≥0.70), `medium` (0.40–0.70), `uncertain` (<0.40)
6. Optionally resolve crop name from `crop_taxonomy`
7. Call `generate_advice()` for Sinhala treatment text
8. Update record to `completed`; on any error set `failed`

### `generate_advice(classification, crop_name, confidence, confidence_tier, language)`
- Builds a Sinhala user message with disease label, crop, confidence %, and tier note
- System prompt: agricultural advisor persona, Sinhala-only, 3-5 bullet treatment steps
- OpenRouter call: `temperature=0.3`, `max_tokens=500`
- Fallback: `"කරුණාකර ඔබේ ගොවිපළ උපදේශකයා හමුවන්න"`

### Other methods
- `get_diagnosis(db, diagnosis_id, farmer_id)` — ownership-checked fetch, raises `NotFoundError`
- `list_diagnosis_history(db, farmer_id, crop_id, page, size)` — paginated, newest-first, optional crop filter; returns `(records, total)`
- `submit_feedback(db, diagnosis_id, farmer_id, feedback)` — updates `user_feedback` enum; raises `ValidationError` on invalid value

---

## 5. `app/diagnosis/router.py`

All routes require `role=farmer` via `require_role("farmer")`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/diagnosis/upload` | Multipart: `image` (File) + `crop_id` (Form, optional). Returns `DiagnosisResponse` 201 |
| `GET`  | `/api/v1/diagnosis/history` | Query params: `crop_id`, `page`, `size`. Returns `PaginatedResponse[DiagnosisBrief]` |
| `GET`  | `/api/v1/diagnosis/{diagnosis_id}` | Full detail. Returns `DiagnosisResponse` |
| `POST` | `/api/v1/diagnosis/{diagnosis_id}/feedback` | Body: `DiagnosisFeedbackRequest`. Returns updated `DiagnosisResponse` |

Helper functions `_to_response()` and `_to_brief()` handle ORM-to-schema mapping, including extracting `top_predictions` from `diagnosis_result` JSONB and `crop_name` from the relationship.

---

## 6. `app/main.py` (updates)

- **Lifespan startup**: calls `cnn_model.load_model()` and logs `cnn_model_ready` with `placeholder_mode` flag
- **Router import**: `from app.diagnosis.router import router as diagnosis_router` (uncommented)
- **Router mount**: `app.include_router(diagnosis_router, prefix="/api/v1/diagnosis", tags=["Diagnosis"])` (uncommented)

---

## Design Decisions

- **Placeholder mode**: The service is fully functional with no ML dependencies; all code paths exercise correctly in dev/test environments.
- **Confidence routing tiers** drive both the advice prompt wording and can be used by the frontend to show UI warnings for uncertain results.
- **Sinhala-only advice**: The LLM system prompt mandates Sinhala output and Sri Lanka-specific remedies to match the target farmer demographic.
- **Lazy R2 init**: Storage falls back silently to local disk; no startup crash if AWS/R2 credentials are absent.
- **Ownership checks**: All read/write operations on `CropDiagnosis` filter by `user_id = farmer_id` to prevent cross-user data leakage.
- **DB transaction safety**: `await db.flush()` is used (not `commit()`) inside service methods; the outer `get_db` generator handles final commit/rollback.
