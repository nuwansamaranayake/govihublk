# Prompt 08 — RAG Advisory Module (Sinhala Agricultural Q&A)

## Context
Disease diagnosis works. Now build the RAG (Retrieval-Augmented Generation) pipeline for general agricultural Q&A in Sinhala.

## Objective
Implement the full RAG pipeline: query embedding, pgvector similarity search, prompt construction, and OpenRouter generation of grounded Sinhala answers.

## Instructions

### 1. app/advisory/schemas.py

- `AdvisoryQuestionRequest`: question (str), language (si/en, default si), crop_id (opt UUID — for context)
- `AdvisoryResponse`: id, question, answer, sources (list of {source_name, relevance_score}), language, created_at
- `AdvisoryHistoryFilter`: language (opt), crop_id (opt), page, size

### 2. app/advisory/embeddings.py

```python
class EmbeddingService:
    """
    Wraps sentence-transformers MiniLM-L12-v2 for multilingual embeddings.
    384-dimensional vectors. Supports Sinhala, English, Tamil.
    """
    MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
    DIMENSION = 384
    
    def __init__(self):
        self.model = None
    
    async def load_model(self):
        """Load at app startup. Cache in /app/ml/embeddings/"""
        from sentence_transformers import SentenceTransformer
        self.model = SentenceTransformer(self.MODEL_NAME, cache_folder="/app/ml/embeddings")
    
    def embed(self, text: str) -> list[float]:
        """Generate 384-dim embedding for a text string."""
        return self.model.encode(text).tolist()
    
    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Batch embedding for multiple texts."""
        return self.model.encode(texts).tolist()
```

Load at startup alongside CNN model. Make available via dependency.

### 3. app/advisory/service.py

**AdvisoryService** class:

- `ask_question(user_id, question, language, crop_id)`:
  1. Embed the question using EmbeddingService
  2. pgvector ANN search: find top-5 most similar chunks
     ```sql
     SELECT id, source, content, metadata,
            1 - (embedding <=> :query_embedding) as similarity
     FROM knowledge_chunks
     WHERE language = :language
     ORDER BY embedding <=> :query_embedding
     LIMIT 5
     ```
     If no Sinhala matches (similarity < 0.3), fall back to English chunks.
  3. Build OpenRouter prompt:
     - System: "You are an agricultural advisor for Sri Lankan farmers. Answer ONLY in {language}. Base your answer on the following reference documents. If the documents don't contain relevant information, say so honestly. Do not make up information. Be practical and specific to Sri Lankan conditions."
     - User: "Reference documents:\n{chunks_text}\n\nFarmer's question: {question}"
  4. Call OpenRouter with temperature=0.3, max_tokens=600
  5. Store AdvisoryQuestion record (question, answer, chunks_used)
  6. Return response with source attribution

- `get_history(user_id, filters)` → Paginated advisory history

### 4. Knowledge Base Management

**app/advisory/knowledge.py**:

- `ingest_document(file_path, source_name, language, metadata)`:
  - Read document (text/markdown)
  - Chunk into ~500-word segments with 50-word overlap
  - Embed each chunk
  - Insert into knowledge_chunks table
  - Return count of chunks created

- `search_similar(query_embedding, language, limit)`:
  - pgvector ANN search
  - Return chunks with similarity scores

Update **scripts/seed_knowledge.py** to actually work:
- Create a `knowledge_base/` directory with 5-10 sample documents:
  - `rice_cultivation_si.md` — Rice growing best practices in Sinhala
  - `pest_management_si.md` — Common pest management in Sinhala
  - `organic_farming_si.md` — Organic farming methods in Sinhala
  - `water_management_en.md` — Irrigation and water management in English
  - `fertilizer_guide_en.md` — Fertilizer application guide in English
- Each document should be 500-1000 words of real agricultural content relevant to Sri Lanka's dry zone
- The seed script loads, chunks, embeds, and stores these documents

### 5. app/advisory/router.py

```
POST   /advisory/ask                — Ask a question (farmer only, auth required)
GET    /advisory/history            — My question history (farmer only)
GET    /advisory/{id}               — Single advisory detail
```

### 6. Admin Knowledge Management Endpoints (in admin module later)

For now, create the service methods that admin will call:
- `ingest_document()` — already in knowledge.py
- `list_chunks(filters)` — paginated list of knowledge chunks
- `delete_chunk(chunk_id)` — remove a chunk
- `get_ingestion_stats()` — total chunks, by language, by source

### 7. Register Router and Startup

Add advisory router to main.py. Load embedding model in lifespan.

## Verification

1. Question embedding generates 384-dim vector
2. pgvector search returns relevant chunks
3. OpenRouter generates coherent Sinhala answer
4. Source attribution is included in response
5. Fallback to English chunks when Sinhala unavailable
6. Advisory history is paginated
7. Knowledge base seed script creates chunks

## Output Report
Write report to: `/home/claude/govihub-prompts/reports/REPORT_08_ADVISORY.md`
