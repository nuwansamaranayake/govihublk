"""GoviHub Advisory Service — RAG pipeline: embed → ANN search → LLM → store."""

import math
import re
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

# Threshold below which RAG chunks are considered irrelevant, triggering
# a Gemini Flash general-knowledge fallback.
_RAG_RELEVANCE_THRESHOLD = 0.35

# ---------------------------------------------------------------------------
# Crop-type detection — map question keywords to knowledge_chunks metadata
# ---------------------------------------------------------------------------
_CROP_KEYWORDS: dict[str, list[str]] = {
    "turmeric":     ["turmeric", "කහ", "கஞ்சள்", "manjal"],
    "ginger":       ["ginger", "ඉඟුරු", "இஞ்சி", "inguru"],
    "black_pepper": ["pepper", "ගම්මිරිස්", "மிளகு", "gammiris", "black pepper"],
    "cinnamon":     ["cinnamon", "කුරුඳු", "இலவங்கப்பட்டை", "kurundu"],
    "cloves":       ["clove", "cloves", "කරාබු", "கிராம்பு", "karabu"],
    "nutmeg":       ["nutmeg", "සාදික්කා", "ஜாதிக்காய்", "sadikka"],
    "cardamom":     ["cardamom", "එනසාල්", "ஏலக்காய்", "ensal"],
    "mixed_spices": ["mixed spice", "මිශ්‍ර කුළුබඩු", "கலவை மசாலா"],
}


def _detect_crop_type(question: str) -> Optional[str]:
    """Return the crop_type metadata value if the question mentions a specific crop."""
    q_lower = question.lower()
    for crop_type, keywords in _CROP_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in q_lower:
                return crop_type
    return None


# Phrases that indicate the RAG LLM couldn't answer — trigger Gemini fallback
_CANT_ANSWER_PHRASES = [
    "i'm sorry", "i am sorry", "do not contain", "does not contain",
    "no information", "not contain sufficient", "cannot find",
    "no relevant", "not available", "cannot answer",
    "මට සමාවෙන්න", "තොරතුරු නොමැත", "ප්‍රමාණවත් තොරතුරු නොමැත",
]


def _llm_says_no_info(answer: str) -> bool:
    """Return True if the RAG LLM response indicates it couldn't answer."""
    a_lower = answer.lower()
    return any(phrase in a_lower for phrase in _CANT_ANSWER_PHRASES)

# Gemini Flash model for general agriculture fallback
_GEMINI_FLASH_MODEL = "google/gemini-2.0-flash-001"

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

# Gemini Flash fallback prompts — general agriculture knowledge (no RAG docs)
_GEMINI_SYSTEM_EN = (
    "You are GoviHub's agricultural advisor for Sri Lankan farmers. "
    "Answer the farmer's question using your general knowledge of tropical agriculture, "
    "Sri Lankan farming practices, spice cultivation, and crop management. "
    "Be practical, concise (under 400 words), and use plain language. "
    "Always prioritise safe, sustainable, and locally-appropriate recommendations. "
    "If you are not confident about the answer, say so honestly."
)

_GEMINI_SYSTEM_SI = (
    "ඔබ GoviHub හි ශ්‍රී ලංකාවේ ගොවීන් සඳහා කෘෂිකාර්මික උපදේශකයෙකු. "
    "නිවර්තන කෘෂිකර්මය, ශ්‍රී ලාංකික ගොවිතැන් ක්‍රම, කුළුබඩු වගාව සහ බෝග කළමනාකරණය "
    "පිළිබඳ ඔබේ සාමාන්‍ය දැනුම භාවිතයෙන් ගොවියාගේ ප්‍රශ්නයට පිළිතුරු දෙන්න. "
    "ප්‍රායෝගික, කෙටි (වචන 400 ට අඩු) සහ සරල භාෂාවෙන් ලියන්න. "
    "පිළිතුර ගැන විශ්වාස නැත්නම් අවංකව කියන්න."
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

        # 1b. Detect crop type from question for filtered search
        detected_crop = _detect_crop_type(question)
        if detected_crop:
            logger.info("advisory_crop_detected", crop_type=detected_crop)

        # 2. Primary language ANN search (with optional crop filter)
        chunks = await self._search_chunks(
            query_embedding, language, limit=5, crop_type=detected_crop
        )

        # 2b. If crop-filtered search returned too few results, try without filter
        if detected_crop and (
            not chunks or all(c["similarity"] < _SIMILARITY_THRESHOLD for c in chunks)
        ):
            logger.info("advisory_crop_filter_fallback", crop_type=detected_crop)
            chunks = await self._search_chunks(query_embedding, language, limit=5)

        # 3. Fallback to English when Sinhala results are below threshold
        used_language = language
        if language == "si" and (
            not chunks or all(c["similarity"] < _SIMILARITY_THRESHOLD for c in chunks)
        ):
            logger.info("advisory_fallback_to_english", user_id=str(user_id))
            chunks = await self._search_chunks(
                query_embedding, "en", limit=5, crop_type=detected_crop
            )
            # If crop-filtered English also low, try unfiltered English
            if detected_crop and (
                not chunks or all(c["similarity"] < _SIMILARITY_THRESHOLD for c in chunks)
            ):
                chunks = await self._search_chunks(query_embedding, "en", limit=5)
            used_language = "en"

        # 4. Decide: RAG path or Gemini Flash fallback
        best_score = max((c["similarity"] for c in chunks), default=0.0)
        use_gemini_fallback = best_score < _RAG_RELEVANCE_THRESHOLD

        if use_gemini_fallback:
            logger.info(
                "advisory_gemini_fallback",
                user_id=str(user_id),
                best_score=round(best_score, 4),
                threshold=_RAG_RELEVANCE_THRESHOLD,
            )
            answer_text, source_type, chunks = await self._gemini_answer(
                question, language
            )
        else:
            source_type = "knowledge_base"
            # Standard RAG path
            system_prompt = _SYSTEM_PROMPT_SI if language == "si" else _SYSTEM_PROMPT_EN
            user_message = self._build_user_message(question, chunks, language)

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

            # 4b. Post-RAG fallback: if the LLM says "I don't know", re-route to Gemini
            if _llm_says_no_info(answer_text):
                logger.info(
                    "advisory_gemini_fallback_post_rag",
                    user_id=str(user_id),
                    reason="llm_says_no_info",
                )
                answer_text, source_type, chunks = await self._gemini_answer(
                    question, language
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
            source_type=source_type,
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

    async def _gemini_answer(
        self,
        question: str,
        language: str,
    ) -> tuple[str, str, list]:
        """Call Gemini Flash for a general-knowledge answer.

        Returns (answer_text, source_type, chunks).
        """
        gemini_system = _GEMINI_SYSTEM_SI if language == "si" else _GEMINI_SYSTEM_EN
        gemini_client = OpenRouterClient(model=_GEMINI_FLASH_MODEL)
        try:
            llm_resp = await gemini_client.chat(
                messages=[{"role": "user", "content": question}],
                system=gemini_system,
                temperature=0.4,
                max_tokens=800,
            )
            return llm_resp.content, "ai_generated", []
        except Exception as exc:  # noqa: BLE001
            logger.error("advisory_gemini_failed", error=str(exc))
            return (
                "We encountered an issue generating a response. "
                "Please try again in a moment."
            ), "ai_generated", []

    async def _search_chunks(
        self,
        query_embedding: list[float],
        language: str,
        limit: int = 5,
        crop_type: Optional[str] = None,
    ) -> list[dict]:
        """Run pgvector ANN search and return top-N chunks with similarity scores.

        When *crop_type* is provided, only chunks matching that crop are searched.
        """
        emb_literal = "'" + "[" + ",".join(str(x) for x in query_embedding) + "]" + "'::vector"

        crop_filter = ""
        params: dict = {"lang": language, "lim": limit}
        if crop_type:
            crop_filter = "AND metadata->>'crop_type' = :crop_type"
            params["crop_type"] = crop_type

        sql = text(
            f"""
            SELECT
                id,
                source,
                title,
                content,
                metadata,
                1 - (embedding <=> {emb_literal}) AS similarity
            FROM knowledge_chunks
            WHERE language = :lang
              {crop_filter}
            ORDER BY embedding <=> {emb_literal}
            LIMIT :lim
            """
        )

        try:
            result = await self.db.execute(sql, params)
            rows = result.mappings().all()
            return [dict(row) for row in rows]
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "advisory_chunk_search_failed",
                error=str(exc),
                language=language,
                crop_type=crop_type,
            )
            await self.db.rollback()
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

        # Determine source_type: if no chunks were used, it was a Gemini fallback
        source_type = "ai_generated" if not sources else "knowledge_base"

        return AdvisoryResponse(
            id=record.id,
            question=record.question_text,
            answer=record.answer_text or "",
            sources=sources,
            source_type=source_type,
            language=record.language,
            created_at=record.created_at,
        )
