"""GoviHub Storage Service — Image upload with Cloudflare R2 and local fallback."""

import os
import uuid
from io import BytesIO
from pathlib import Path
from typing import Optional

import structlog

from app.config import settings
from app.exceptions import ValidationError

logger = structlog.get_logger()

# Allowed MIME types and their extensions
ALLOWED_CONTENT_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
LOCAL_UPLOAD_DIR = Path("/app/uploads")


class StorageService:
    """Handles image uploads to Cloudflare R2 with fallback to local filesystem."""

    def __init__(self) -> None:
        self._r2_client = None
        self._r2_available: bool = False
        self._init_r2()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def upload_image(
        self,
        file_bytes: bytes,
        content_type: str,
        folder: str = "diagnoses",
        filename: Optional[str] = None,
    ) -> str:
        """Validate and upload an image; return its public URL.

        Args:
            file_bytes: Raw image bytes.
            content_type: MIME type reported by the client.
            folder: Destination folder / prefix inside the bucket.
            filename: Override file name (without extension). Defaults to UUID4.

        Returns:
            Publicly accessible URL string.

        Raises:
            ValidationError: When file type or size is invalid.
        """
        self._validate(file_bytes, content_type)

        ext = ALLOWED_CONTENT_TYPES[content_type]
        stem = filename or str(uuid.uuid4())
        object_key = f"{folder}/{stem}{ext}"

        if self._r2_available:
            return await self._upload_r2(file_bytes, object_key, content_type)

        return self._upload_local(file_bytes, object_key)

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    @staticmethod
    def _validate(file_bytes: bytes, content_type: str) -> None:
        """Raise ValidationError if the file fails type or size checks."""
        normalised = content_type.lower().split(";")[0].strip()
        if normalised not in ALLOWED_CONTENT_TYPES:
            raise ValidationError(
                detail=f"Unsupported file type '{content_type}'. Only JPEG, PNG, and WebP are accepted.",
                details={"allowed": list(ALLOWED_CONTENT_TYPES.keys())},
            )
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise ValidationError(
                detail=f"File too large ({len(file_bytes):,} bytes). Maximum is 10 MB.",
                details={"max_bytes": MAX_FILE_SIZE_BYTES},
            )

    # ------------------------------------------------------------------
    # R2 (Cloudflare) backend
    # ------------------------------------------------------------------

    def _init_r2(self) -> None:
        """Initialise the boto3 S3 client pointing at Cloudflare R2."""
        if not all(
            [
                settings.R2_ACCESS_KEY_ID,
                settings.R2_SECRET_ACCESS_KEY,
                settings.R2_ACCOUNT_ID,
            ]
        ):
            logger.info("storage_r2_disabled", reason="credentials_not_configured")
            return

        try:
            import boto3  # type: ignore

            endpoint_url = f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
            self._r2_client = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                region_name="auto",
            )
            self._r2_available = True
            logger.info("storage_r2_ready", bucket=settings.R2_BUCKET_NAME)
        except ImportError:
            logger.warning("storage_r2_boto3_missing", fallback="local")
        except Exception as exc:  # noqa: BLE001
            logger.error("storage_r2_init_failed", error=str(exc), fallback="local")

    async def _upload_r2(self, file_bytes: bytes, object_key: str, content_type: str) -> str:
        """Upload bytes to Cloudflare R2 and return the public URL."""
        try:
            import asyncio

            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: self._r2_client.put_object(  # type: ignore[union-attr]
                    Bucket=settings.R2_BUCKET_NAME,
                    Key=object_key,
                    Body=file_bytes,
                    ContentType=content_type,
                ),
            )
            url = f"{settings.R2_PUBLIC_URL.rstrip('/')}/{object_key}"
            logger.info("storage_r2_uploaded", key=object_key, bytes=len(file_bytes))
            return url
        except Exception as exc:  # noqa: BLE001
            logger.error("storage_r2_upload_failed", error=str(exc), fallback="local")
            return self._upload_local(file_bytes, object_key)

    # ------------------------------------------------------------------
    # Local filesystem fallback
    # ------------------------------------------------------------------

    @staticmethod
    def _upload_local(file_bytes: bytes, object_key: str) -> str:
        """Save bytes to /app/uploads/ and return a relative URL path."""
        dest = LOCAL_UPLOAD_DIR / object_key
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(file_bytes)
        url = f"/uploads/{object_key}"
        logger.info("storage_local_saved", path=str(dest), bytes=len(file_bytes))
        return url


# Module-level singleton
storage_service = StorageService()
