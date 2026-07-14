# API Contract — Diagnosis History

Verified against `spices` (2026-07-14). Root cause + audit: [DIAGNOSIS_HISTORY_AUDIT.md](../../DIAGNOSIS_HISTORY_AUDIT.md).

## GET /api/v1/diagnosis/history

Auth: `require_role("farmer")` (farmer with a complete profile). Query: `crop_id?`, `page=1`, `size=20`.

**200 OK** — `PaginatedResponse`:
```json
{
  "data": [
    {
      "id": "uuid",
      "disease_name": "Leaf Blotch (Taphrina maculans)",
      "confidence": 0.88,
      "image_url": "https://…",
      "status": "completed",
      "created_at": "2026-07-14T…"
    }
  ],
  "meta": { "page": 1, "size": 20, "total": 13, "pages": 1 }
}
```

`status` ∈ `pending | processing | completed | failed` (`diagnosis/models.py DiagnosisStatus`).
`disease_name` is nullable — a **completed** record with `disease_name: null` means the AI found no disease (render "No disease detected", not a failure).

> **Fields are snake_case** and must be read as-is (`disease_name`, `image_url`, `created_at`) — matching the detail schema `DiagnosisResponse` and the `DiagnosisResult` frontend type. The bug fixed here was the history card reading a non-existent `disease` field. `status` was added to `DiagnosisBrief` so the card can flag *only* genuine failures (`status === 'failed'`): a failed card shows a retry hint and **no** confidence %.

## Localisation decision (Sinhala/Tamil)

The AI returns disease names as **English free text with Latin scientific names**
(e.g. "Bacterial Wilt (Ralstonia solanacearum)"). These are **rendered in English in all
locales** — scientific/Latin names must not be machine-translated. Only UI chrome
(the failure label, retry hint, "No disease detected") is localised (EN/SI/TA).
If the backend later adds a `disease_name_si`/`disease_name_ta`, prefer it when present.
