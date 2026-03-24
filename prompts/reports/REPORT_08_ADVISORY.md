# REPORT 08 — Advisory RAG Module

**Date:** 2026-03-23
**Prompt:** 08 — Advisory RAG Module
**Status:** COMPLETE

---

## Summary

Implemented a complete Retrieval-Augmented Generation (RAG) advisory pipeline for GoviHub. Farmers submit questions in Sinhala or English; the system embeds the query, performs a pgvector ANN search over the knowledge base, injects the top-5 relevant chunks into an LLM prompt, and returns a grounded answer with source references.

---

## Files Created / Modified

### New Files

| File | Purpose |
|------|---------|
| `govihub-api/app/advisory/schemas.py` | Pydantic request/response models |
| `govihub-api/app/advisory/embeddings.py` | EmbeddingService wrapping sentence-transformers |
| `govihub-api/app/advisory/service.py` | AdvisoryService — full RAG pipeline |
| `govihub-api/app/advisory/knowledge.py` | Document ingestion, chunking, and retrieval utilities |
| `govihub-api/app/advisory/router.py` | FastAPI router — 3 endpoints |
| `govihub-api/knowledge_base/rice_cultivation_si.md` | Sinhala rice cultivation guide (~500 words) |
| `govihub-api/knowledge_base/pest_management_en.md` | English IPM guide for dry zone (~550 words) |
| `govihub-api/knowledge_base/organic_farming_en.md` | English organic farming guide (~600 words) |

### Modified Files

| File | Change |
|------|--------|
| `govihub-api/app/main.py` | Uncommented advisory router import and `include_router`; added `embedding_service.load_model()` in lifespan |

---

## Module Architecture

```
POST /api/v1/advisory/ask
  └─ router.py  →  AdvisoryService.ask_question()
       ├─ EmbeddingService.embed(question)          # 384-dim vector
       ├─ pgvector ANN search (language=si, top-5)   # SQL via sqlalchemy text()
       ├─ Fallback to English if similarity < 0.3
       ├─ Build prompt with reference chunks
       ├─ OpenRouterClient.chat(temp=0.3, max_tokens=600)
       └─ AdvisoryQuestion INSERT → AdvisoryResponse

GET  /api/v1/advisory/history   →  AdvisoryService.get_history()
GET  /api/v1/advisory/{id}      →  AdvisoryService.get_by_id()
```

---

## Design Decisions

### 1. EmbeddingService (embeddings.py)
- Model: `paraphrase-multilingual-MiniLM-L12-v2` (384-dim, supports Sinhala + English)
- Cache folder: `/app/ml/embeddings` (Docker volume mount)
- Loaded at startup via `run_in_executor` to avoid blocking the async event loop
- Placeholder mode: when `sentence-transformers` is not installed or the model files are absent, returns random unit-normalised 384-dim vectors so the rest of the stack remains functional

### 2. pgvector ANN Search (service.py)
- Raw SQL via `sqlalchemy.text()` using the `<=>` (cosine distance) operator
- Similarity score = `1 - (embedding <=> query_embedding::vector)`
- Primary search in the requested language; automatic fallback to English when all Sinhala similarities are below 0.3
- Embedding serialised as `[f1,f2,...,f384]` string and cast with `::vector` in the query

### 3. Document Ingestion (knowledge.py)
- Word-based chunking: 500-word windows with 50-word overlap
- `ingest_document()` reads any text/markdown file, chunks it, batch-embeds, and inserts `KnowledgeChunk` rows
- Helper functions: `search_similar`, `list_chunks`, `delete_chunk`, `get_ingestion_stats`

### 4. Router (router.py)
- `POST /advisory/ask` — requires `farmer` or `admin` role (via `require_role` dependency)
- `GET /advisory/history` — paginated, filterable by language
- `GET /advisory/{id}` — single question detail scoped to the requesting user

### 5. Knowledge Base Files
Three `.md` files placed in `govihub-api/knowledge_base/`:

| File | Language | Topic |
|------|----------|-------|
| `rice_cultivation_si.md` | Sinhala (si) | Land prep, varieties, planting, fertiliser, harvest for dry zone rice |
| `pest_management_en.md` | English (en) | IPM: BPH, gall midge, thrips, biological control, economic thresholds |
| `organic_farming_en.md` | English (en) | Compost, green manure, neem spray, mulching, certification, ROI |

---

## API Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/advisory/ask` | farmer/admin | Submit question, returns RAG answer |
| GET | `/api/v1/advisory/history` | farmer/admin | Paginated question history |
| GET | `/api/v1/advisory/{id}` | farmer/admin | Single question detail |

### Example Request — POST /advisory/ask
```json
{
  "question": "වී වගාවේ දී BPH කළමනාකරණය කරන්නේ කෙසේ ද?",
  "language": "si",
  "crop_id": null
}
```

### Example Response
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "question": "වී වගාවේ දී BPH කළමනාකරණය කරන්නේ කෙසේ ද?",
  "answer": "BPH (Brown Planthopper) වී ශාකයේ...",
  "sources": [
    {"source_name": "pest_management_en", "relevance_score": 0.82},
    {"source_name": "rice_cultivation_si", "relevance_score": 0.71}
  ],
  "language": "si",
  "created_at": "2026-03-23T09:15:00Z"
}
```

---

## Startup Integration

`app/main.py` lifespan now:
1. Loads CNN diagnosis model (existing)
2. Loads embedding model via `run_in_executor(None, embedding_service.load_model)`
3. Logs `embedding_model_ready` with `placeholder_mode` flag

---

## Dependencies Required

Add to `requirements.txt` / `pyproject.toml`:
```
sentence-transformers>=2.6.0
```
The model will be downloaded automatically on first startup or can be pre-baked into the Docker image at `/app/ml/embeddings/`.
