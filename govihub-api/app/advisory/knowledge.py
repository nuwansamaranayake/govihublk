"""GoviHub Advisory Knowledge — Document ingestion, chunking, and retrieval utilities."""

import re
from pathlib import Path
from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.advisory.embeddings import embedding_service
from app.advisory.models import KnowledgeChunk
from app.exceptions import NotFoundError

logger = structlog.get_logger()

_CHUNK_WORDS = 500       # target chunk size in words
_OVERLAP_WORDS = 50      # overlap between consecutive chunks


# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------


async def ingest_document(
    db: AsyncSession,
    file_path: str,
    source_name: str,
    language: str = "en",
    metadata: Optional[dict] = None,
) -> list[UUID]:
    """Read a file, chunk it, embed each chunk, and insert into knowledge_chunks.

    Args:
        db: Async SQLAlchemy session.
        file_path: Absolute path to the document file (.md, .txt, etc.).
        source_name: Human-readable source name stored on each chunk.
        language: Language code ('en' or 'si').
        metadata: Optional key-value dict stored as JSONB on each chunk.

    Returns:
        List of newly created KnowledgeChunk UUIDs.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Document not found: {file_path}")

    raw_text = path.read_text(encoding="utf-8")
    title = path.stem.replace("_", " ").title()

    chunks_text = _split_into_chunks(raw_text, _CHUNK_WORDS, _OVERLAP_WORDS)
    logger.info(
        "knowledge_ingestion_start",
        source=source_name,
        language=language,
        chunks=len(chunks_text),
    )

    embeddings = embedding_service.embed_batch(chunks_text)

    inserted_ids: list[UUID] = []
    for i, (chunk_text, embedding) in enumerate(zip(chunks_text, embeddings)):
        chunk = KnowledgeChunk(
            source=source_name,
            title=f"{title} (part {i + 1})" if len(chunks_text) > 1 else title,
            content=chunk_text.strip(),
            language=language,
            embedding=embedding,
            metadata_=metadata or {},
        )
        db.add(chunk)
        await db.flush()
        inserted_ids.append(chunk.id)

    logger.info(
        "knowledge_ingestion_complete",
        source=source_name,
        inserted=len(inserted_ids),
    )
    return inserted_ids


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


async def search_similar(
    db: AsyncSession,
    query_embedding: list[float],
    language: str = "en",
    limit: int = 10,
) -> list[dict]:
    """Return the top-N most similar knowledge chunks to a query embedding.

    Args:
        db: Async SQLAlchemy session.
        query_embedding: 384-dim float list from the embedding service.
        language: Filter chunks by language code.
        limit: Maximum number of results.

    Returns:
        List of dicts with keys: id, source, title, content, similarity.
    """
    emb_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    sql = text(
        """
        SELECT
            id,
            source,
            title,
            content,
            1 - (embedding <=> :emb::vector) AS similarity
        FROM knowledge_chunks
        WHERE language = :lang
        ORDER BY embedding <=> :emb::vector
        LIMIT :lim
        """
    )

    result = await db.execute(sql, {"emb": emb_str, "lang": language, "lim": limit})
    return [dict(row) for row in result.mappings().all()]


# ---------------------------------------------------------------------------
# CRUD helpers
# ---------------------------------------------------------------------------


async def list_chunks(
    db: AsyncSession,
    source_name: Optional[str] = None,
    language: Optional[str] = None,
    page: int = 1,
    size: int = 50,
) -> dict:
    """List knowledge chunks with optional filters and pagination."""
    query = select(KnowledgeChunk)

    if source_name:
        query = query.where(KnowledgeChunk.source == source_name)
    if language:
        query = query.where(KnowledgeChunk.language == language)

    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar_one()

    offset = (page - 1) * size
    rows_result = await db.execute(
        query.order_by(KnowledgeChunk.created_at.desc()).offset(offset).limit(size)
    )
    chunks = rows_result.scalars().all()

    return {
        "items": [
            {
                "id": str(c.id),
                "source": c.source,
                "title": c.title,
                "language": c.language,
                "content_preview": c.content[:200],
                "created_at": c.created_at.isoformat(),
            }
            for c in chunks
        ],
        "total": total,
        "page": page,
        "size": size,
    }


async def delete_chunk(db: AsyncSession, chunk_id: UUID) -> None:
    """Delete a single knowledge chunk by ID.

    Raises:
        NotFoundError: If no chunk with the given ID exists.
    """
    result = await db.execute(
        select(KnowledgeChunk).where(KnowledgeChunk.id == chunk_id)
    )
    chunk = result.scalar_one_or_none()
    if not chunk:
        raise NotFoundError(detail=f"Knowledge chunk {chunk_id} not found")

    await db.execute(
        delete(KnowledgeChunk).where(KnowledgeChunk.id == chunk_id)
    )
    logger.info("knowledge_chunk_deleted", chunk_id=str(chunk_id))


async def get_ingestion_stats(db: AsyncSession) -> dict:
    """Return aggregate statistics about the knowledge base.

    Returns:
        Dict with total chunk count and per-language/per-source breakdowns.
    """
    total_result = await db.execute(select(func.count()).select_from(KnowledgeChunk))
    total = total_result.scalar_one()

    # Per-language counts
    lang_result = await db.execute(
        select(KnowledgeChunk.language, func.count().label("cnt"))
        .group_by(KnowledgeChunk.language)
    )
    by_language = {row.language: row.cnt for row in lang_result}

    # Per-source counts
    source_result = await db.execute(
        select(KnowledgeChunk.source, func.count().label("cnt"))
        .group_by(KnowledgeChunk.source)
        .order_by(func.count().desc())
    )
    by_source = {row.source: row.cnt for row in source_result}

    return {
        "total_chunks": total,
        "by_language": by_language,
        "by_source": by_source,
        "embedding_model": "paraphrase-multilingual-MiniLM-L12-v2",
        "embedding_dim": 384,
        "placeholder_mode": embedding_service.is_placeholder,
    }


# ---------------------------------------------------------------------------
# Text splitting utility
# ---------------------------------------------------------------------------


def _split_into_chunks(text: str, chunk_words: int, overlap_words: int) -> list[str]:
    """Split *text* into overlapping word-based chunks.

    Args:
        text: Raw document text.
        chunk_words: Target number of words per chunk.
        overlap_words: Number of words to repeat at the start of each subsequent
            chunk to preserve context across boundaries.

    Returns:
        List of text chunks (strings).
    """
    # Normalise whitespace while preserving paragraph breaks
    text = re.sub(r"\n{3,}", "\n\n", text.strip())

    words = text.split()
    if not words:
        return []

    chunks: list[str] = []
    start = 0

    while start < len(words):
        end = min(start + chunk_words, len(words))
        chunk = " ".join(words[start:end])
        chunks.append(chunk)

        if end == len(words):
            break  # last chunk reached

        # Advance by (chunk_words - overlap_words) so next chunk overlaps
        start += max(chunk_words - overlap_words, 1)

    return chunks
