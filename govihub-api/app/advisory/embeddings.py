"""GoviHub Advisory Embeddings — Sentence-transformer embedding service (384-dim)."""

import random
from typing import Optional

import structlog

logger = structlog.get_logger()

_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
_EMBEDDING_DIM = 384
_CACHE_FOLDER = "/app/ml/embeddings"


class EmbeddingService:
    """Wraps sentence-transformers to produce 384-dim embeddings.

    Falls back to random vectors when the model is unavailable (e.g., during
    local development without the model downloaded).
    """

    def __init__(self):
        self._model = None
        self._placeholder_mode = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load_model(self) -> None:
        """Load the multilingual MiniLM model from the local cache folder.

        Sets ``_placeholder_mode = True`` when the library or the model files
        are not available so that the rest of the application degrades
        gracefully rather than failing at startup.
        """
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore

            self._model = SentenceTransformer(
                _MODEL_NAME,
                cache_folder=_CACHE_FOLDER,
            )
            self._placeholder_mode = False
            logger.info(
                "embedding_model_loaded",
                model=_MODEL_NAME,
                dim=_EMBEDDING_DIM,
            )
        except ImportError:
            logger.warning(
                "embedding_model_unavailable",
                reason="sentence-transformers not installed",
                fallback="placeholder_random_vectors",
            )
            self._placeholder_mode = True
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "embedding_model_load_failed",
                error=str(exc),
                fallback="placeholder_random_vectors",
            )
            self._placeholder_mode = True

    def embed(self, text: str) -> list[float]:
        """Embed a single text string into a 384-dim float vector.

        Args:
            text: Input text (any language).

        Returns:
            List of 384 floats representing the sentence embedding.
        """
        if self._placeholder_mode or self._model is None:
            return self._random_vector()

        try:
            vector = self._model.encode(text, convert_to_numpy=True)
            return vector.tolist()
        except Exception as exc:  # noqa: BLE001
            logger.error("embedding_failed", error=str(exc), fallback="random_vector")
            return self._random_vector()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts.

        Args:
            texts: List of input strings.

        Returns:
            List of 384-dim float vectors, one per input text.
        """
        if not texts:
            return []

        if self._placeholder_mode or self._model is None:
            return [self._random_vector() for _ in texts]

        try:
            vectors = self._model.encode(texts, convert_to_numpy=True, batch_size=32)
            return [v.tolist() for v in vectors]
        except Exception as exc:  # noqa: BLE001
            logger.error("embedding_batch_failed", error=str(exc), count=len(texts))
            return [self._random_vector() for _ in texts]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @property
    def is_placeholder(self) -> bool:
        """True when running in placeholder (no real model) mode."""
        return self._placeholder_mode

    @staticmethod
    def _random_vector() -> list[float]:
        """Return a random unit-normalised 384-dim vector for placeholder mode."""
        vec = [random.gauss(0, 1) for _ in range(_EMBEDDING_DIM)]
        magnitude = sum(x * x for x in vec) ** 0.5
        if magnitude == 0:
            magnitude = 1.0
        return [x / magnitude for x in vec]


# ---------------------------------------------------------------------------
# Module-level singleton — shared across all requests
# ---------------------------------------------------------------------------

embedding_service = EmbeddingService()
