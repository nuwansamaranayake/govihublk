"""GoviHub Storage Service — Image upload with Cloudflare R2 and local fallback.

Public URL handling
-------------------
Uploads to Cloudflare R2 are only useful if the resulting URL is publicly
readable. The S3 API endpoint (`<account>.r2.cloudflarestorage.com`) ALWAYS
requires signed `Authorization` headers, so it cannot be used as the public
URL. The public URL is either:
  * `https://pub-<hash>.r2.dev` — assigned when the bucket has "Allow Access"
    toggled in the Cloudflare R2 dashboard, or
  * a custom domain bound to the bucket.

This module:
  1. Optionally auto-discovers the public hostname via the Cloudflare API
     (set `CLOUDFLARE_API_TOKEN` in the environment with R2 read scope).
  2. Validates the resolved public URL with a HEAD on the just-uploaded
     object the first time R2 is used in a process. If the URL is not
     publicly readable, the uploaded object is deleted and an
     `ExternalServiceError` is raised — we will NEVER persist a broken
     image URL to the database silently.
"""

import os
import uuid
from io import BytesIO
from pathlib import Path
from typing import Optional

import httpx
import structlog

from app.config import settings
from app.exceptions import ExternalServiceError, ValidationError

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
        # Public URL state — resolved + validated lazily on first real upload.
        # Holds the validated base (no trailing slash) once proven public.
        self._public_url_resolved: Optional[str] = None
        self._public_url_validated: bool = False
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

    async def _discover_public_base(self) -> Optional[str]:
        """Ask the Cloudflare API for the bucket's managed public domain.

        Requires `CLOUDFLARE_API_TOKEN` to be set in the env with R2 read
        scope on this account. Returns `https://<domain>` if the bucket has
        managed public access enabled, otherwise None.
        """
        token = getattr(settings, "CLOUDFLARE_API_TOKEN", "") or ""
        if not (token and settings.R2_ACCOUNT_ID and settings.R2_BUCKET_NAME):
            return None
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    "https://api.cloudflare.com/client/v4/accounts/"
                    f"{settings.R2_ACCOUNT_ID}/r2/buckets/"
                    f"{settings.R2_BUCKET_NAME}/domains/managed",
                    headers={"Authorization": f"Bearer {token}"},
                )
            if r.status_code != 200:
                logger.warning(
                    "storage_r2_cf_api_unexpected_status",
                    status=r.status_code,
                    body=r.text[:200],
                )
                return None
            result = (r.json() or {}).get("result") or {}
            domain = result.get("domain")
            enabled = result.get("enabled")
            if domain and enabled:
                return f"https://{domain}"
            return None
        except Exception as exc:  # noqa: BLE001
            logger.warning("storage_r2_cf_api_discover_failed", error=str(exc))
            return None

    async def _resolve_and_validate_public_url(self, sample_object_key: str) -> str:
        """Resolve the canonical public base, HEAD the just-uploaded object,
        and confirm public readability.

        Cached on the instance: subsequent uploads in the same process pay
        zero cost. Raises ExternalServiceError with an actionable message
        if the public URL is not readable so we never persist a broken URL.
        """
        if self._public_url_validated and self._public_url_resolved:
            return self._public_url_resolved

        # 1. Try Cloudflare auto-discovery if a CF API token is configured.
        discovered = await self._discover_public_base()
        candidate = (discovered or (settings.R2_PUBLIC_URL or "")).rstrip("/")

        if not candidate:
            raise ExternalServiceError(
                detail=(
                    "R2 upload succeeded but no public base URL is configured. "
                    "Set R2_PUBLIC_URL in .env to the bucket's pub-<hash>.r2.dev "
                    "hostname (Cloudflare R2 dashboard → bucket → Settings → "
                    "Public Access → Allow Access) or to a custom domain. "
                    "Alternatively set CLOUDFLARE_API_TOKEN to auto-discover."
                )
            )

        probe_url = f"{candidate}/{sample_object_key}"
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.head(probe_url)
        except Exception as exc:  # noqa: BLE001
            raise ExternalServiceError(
                detail=(
                    f"R2 upload completed but the public URL could not be "
                    f"reached. Probed: {probe_url}. Error: {exc}"
                )
            ) from exc

        if resp.status_code != 200:
            raise ExternalServiceError(
                detail=(
                    f"R2 upload completed but the configured public URL is "
                    f"not publicly readable (HTTP {resp.status_code} on HEAD "
                    f"{probe_url}). Fix R2_PUBLIC_URL in .env to the bucket's "
                    f"pub-<hash>.r2.dev hostname or a custom domain. To "
                    f"auto-discover, set CLOUDFLARE_API_TOKEN to a CF API "
                    f"token with R2 read scope."
                )
            )

        self._public_url_resolved = candidate
        self._public_url_validated = True
        logger.info(
            "storage_r2_public_url_validated",
            base=candidate,
            via="cloudflare_api" if discovered else "env_R2_PUBLIC_URL",
        )
        return candidate

    async def _upload_r2(self, file_bytes: bytes, object_key: str, content_type: str) -> str:
        """Upload bytes to Cloudflare R2 and return a validated public URL.

        Behaviour:
          * Performs the PUT.
          * On the first upload in this process, validates the public URL by
            HEAD-ing the just-uploaded object. If the URL is not publicly
            readable, the orphan object is deleted and ExternalServiceError
            is raised — the caller MUST NOT persist a broken URL.
          * Subsequent uploads reuse the cached validated base — zero
            additional round-trips.
          * On PUT failure (not URL failure), falls back to local upload
            so the system stays functional during a CF outage.
        """
        import asyncio

        # 1. PUT to R2.
        try:
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
        except Exception as exc:  # noqa: BLE001
            logger.error("storage_r2_upload_failed", error=str(exc), fallback="local")
            return self._upload_local(file_bytes, object_key)

        # 2. Resolve + validate public URL.
        try:
            base = await self._resolve_and_validate_public_url(object_key)
        except ExternalServiceError:
            # Clean up the orphan so we don't accumulate uploaded-but-unreferenced
            # objects in the bucket. Best-effort; ignore delete failures.
            try:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    None,
                    lambda: self._r2_client.delete_object(  # type: ignore[union-attr]
                        Bucket=settings.R2_BUCKET_NAME, Key=object_key
                    ),
                )
            except Exception:  # noqa: BLE001
                pass
            raise

        url = f"{base}/{object_key}"
        logger.info("storage_r2_uploaded", key=object_key, bytes=len(file_bytes), url=url)
        return url

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
