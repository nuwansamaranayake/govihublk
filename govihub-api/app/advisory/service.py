"""GoviHub Advisory Service — RAG pipeline: embed → ANN search → LLM → store."""

import math
from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.advisory.embeddings import embedding_service
from app.advisory.models import AdvisoryQuestion, KnowledgeChunk
from app.advisory.schemas import (
    AdvisoryHistoryFilter,
    AdvisoryHistoryResponse,
    AdvisoryResponse,
    SourceReference,
)
from app.exceptions import NotFoundError
from app.utils.openrouter import OpenRouterClient

logger = structlog.get_logger()

# Threshold below which Sinhala results are considered absent, triggering
# an English fallback search.
_SIMILARITY_THRESHOLD = 0.3

# System prompt for the agricultural advisory LLM
_SYSTEM_PROMPT_EN = (
    "You are GoviHub's agricultural advisor for Sri Lanka's dry zone farming communities. "
    "Answer the farmer's question accurately and practically using the reference documents "
    "provided. If the documents do not contain sufficient information, say so honestly. "
    "Keep the answer concise (under 400 words) and use plain language suitable for farmers. "
    "Always prioritise safe, sustainable, and locally-appropriate recommendations."
)

_SYSTEM_PROMPT_SI = (
    "ඔබ GoviHub හි ශ්‍රී ලංකාවේ වියළි කලාපීය ගොවීන් සඳහා කෘෂිකාර්මික උපදේශකයෙකු. "
    "ලබා දී ඇති යොමු ලේඛන භාවිතා කරමින් ගොවියාගේ ප්‍රශ්නයට නිවැරදිව සහ ප්‍රායෝගිකව "
    "පිළිතුරු දෙන්න. ලේඛනවල ප්‍රමාණවත් තොරතුරු නොමැති නම්솔직ව කියන්න. "
    "පිළිතුර කෙටි (වචන 400 ට අඩු) සහ ගොවීන්ට ගැලපෙන සරල භාෂාවෙන් ලියන්න."
)


class AdvisoryService:
    """Orchestrates the RAG advisory pipeline."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._llm = OpenRouterClient()

    # ------------------------------------------------------------------
    # Core: ask a question
    # ------------------------------------------------------------------

    async def ask_question(
        self,
        user_id: UUID,
        question: str,
        language: str = "si",
        crop_id: Optional[UUID] = None,
    ) -> AdvisoryResponse:
        """Run the full RAG pipeline for a farmer's question.

        Steps:
        1. Embed the question.
        2. ANN search top-5 chunks (primary language).
        3. Fallback to English if Sinhala similarity is too low.
        4. Build a prompt with reference documents.
        5. Call the LLM via OpenRouter.
        6. Persist the AdvisoryQuestion record.
        7. Return AdvisoryResponse.
        """
        logger.info(
            "advisory_ask",
            user_id=str(user_id),
            language=language,
            question_len=len(question),
        )

        # 1. Embed
        query_embedding = embedding_service.embed(question)

        # 2. Primary language ANN search
        chunks = await self._search_chunks(query_embedding, language, limit=5)

        # 3. Fallback to English when Sinhala results are below threshold
        used_language = language
        if language == "si" and (
            not chunks or all(c["similarity"] < _SIMILARITY_THRESHOLD for c in chunks)
        ):
            logger.info("advisory_fallback_to_english", user_id=str(user_id))
            chunks = await self._search_chunks(query_embedding, "en", limit=5)
            used_language = "en"

        # 4. Build prompt
        system_prompt = _SYSTEM_PROMPT_SI if language == "si" else _SYSTEM_PROMPT_EN
        user_message = self._build_user_message(question, chunks, language)

        # 5. Call LLM
        try:
            llm_resp = await self._llm.chat(
                messages=[{"role": "user", "content": user_message}],
                system=system_prompt,
                temperature=0.3,
                max_tokens=600,
            )
            answer_text = llm_resp.content
        except Exception as exc:  # noqa: BLE001
            logger.error("advisory_llm_failed", error=str(exc))
            answer_text = (
                "We encountered an issue generating a response. "
                "Please try again in a moment."
            )

        # 6. Persist
        chunks_used = [
            {
                "chunk_id": str(c["id"]),
                "source": c["source"],
                "title": c["title"],
                "similarity": round(c["similarity"], 4),
            }
            for c in chunks
        ]

        record = AdvisoryQuestion(
            user_id=user_id,
            question_text=question,
            answer_text=answer_text,
            chunks_used=chunks_used,
            language=language,
        )
        self.db.add(record)
        await self.db.flush()  # populate record.id and created_at
        await self.db.refresh(record)

        # 7. Return
        sources = [
            SourceReference(
                source_name=c["source"],
                relevance_score=round(c["similarity"], 4),
            )
            for c in chunks
        ]

        return AdvisoryResponse(
            id=record.id,
            question=record.question_text,
            answer=record.answer_text or "",
            sources=sources,
            language=record.language,
            created_at=record.created_at,
        )

    # ------------------------------------------------------------------
    # History
    # ------------------------------------------------------------------

    async def get_history(
        self,
        user_id: UUID,
        filters: AdvisoryHistoryFilter,
    ) -> AdvisoryHistoryResponse:
        """Return paginated advisory question history for a user."""
        base_query = select(AdvisoryQuestion).where(
            AdvisoryQuestion.user_id == user_id
        )

        if filters.language:
            base_query = base_query.where(
                AdvisoryQuestion.language == filters.language
            )

        # Total count
        count_query = select(func.count()).select_from(base_query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        # Paginated results ordered newest-first
        offset = (filters.page - 1) * filters.size
        rows_query = (
            base_query.order_by(AdvisoryQuestion.created_at.desc())
            .offset(offset)
            .limit(filters.size)
        )
        rows_result = await self.db.execute(rows_query)
        records = rows_result.scalars().all()

        items = [self._record_to_response(r) for r in records]

        return AdvisoryHistoryResponse(
            items=items,
            total=total,
            page=filters.page,
            size=filters.size,
            pages=math.ceil(total / filters.size) if total else 0,
        )

    async def get_by_id(self, question_id: UUID, user_id: UUID) -> AdvisoryResponse:
        """Get a single advisory question by ID (scoped to user)."""
        result = await self.db.execute(
            select(AdvisoryQuestion).where(
                AdvisoryQuestion.id == question_id,
                AdvisoryQuestion.user_id == user_id,
            )
        )
        record = result.scalar_one_or_none()
        if not record:
            raise NotFoundError(detail="Advisory question not found")
        return self._record_to_response(record)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _search_chunks(
        self,
        query_embedding: list[float],
        language: str,
        limit: int = 5,
    ) -> list[dict]:
        """Run pgvector ANN search and return top-N chunks with similarity scores."""
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

        try:
            result = await self.db.execute(
                sql,
                {"emb": emb_str, "lang": language, "lim": limit},
            )
            rows = result.mappings().all()
            return [dict(row) for row in rows]
        except Exception as exc:  # noqa: BLE001
            logger.error("advisory_chunk_search_failed", error=str(exc), language=language)
            return []

    @staticmethod
    def _build_user_message(
        question: str,
        chunks: list[dict],
        language: str,
    ) -> str:
        """Compose the user-turn message with injected reference documents."""
        if not chunks:
            if language == "si":
                return f"ප්‍රශ්නය: {question}\n\n(ප්‍රාසංගික ලේඛන නොමැත)"
            return f"Question: {question}\n\n(No reference documents available.)"

        docs_section = "\n\n".join(
            f"[Document {i + 1}: {c['source']}]\n{c['content'][:800]}"
            for i, c in enumerate(chunks)
        )

        if language == "si":
            return (
                f"යොමු ලේඛන:\n\n{docs_section}\n\n"
                f"---\n"
                f"ගොවියාගේ ප්‍රශ්නය: {question}"
            )

        return (
            f"Reference Documents:\n\n{docs_section}\n\n"
            f"---\n"
            f"Farmer's Question: {question}"
        )

    @staticmethod
    def _record_to_response(record: AdvisoryQuestion) -> AdvisoryResponse:
        """Convert an ORM AdvisoryQuestion to an AdvisoryResponse schema."""
        sources: list[SourceReference] = []
        if record.chunks_used:
            for chunk in record.chunks_used:
                sources.append(
                    SourceReference(
                        source_name=chunk.get("source", "Unknown"),
                        relevance_score=chunk.get("similarity", 0.0),
                    )
                )

        return AdvisoryResponse(
            id=record.id,
            question=record.question_text,
            answer=record.answer_text or "",
            sources=sources,
            language=record.language,
            created_at=record.created_at,
        )
