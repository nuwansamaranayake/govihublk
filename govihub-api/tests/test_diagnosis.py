"""GoviHub Diagnosis Tests — Gemini Vision diagnosis, confidence routing."""

from __future__ import annotations

import io
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.auth.service import create_access_token
from app.diagnosis.service import DiagnosisService


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _minimal_jpeg_bytes() -> bytes:
    """Return minimal valid JPEG bytes for testing."""
    try:
        from PIL import Image as PILImage

        img = PILImage.new("RGB", (64, 64), color=(100, 150, 200))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        return buf.getvalue()
    except ImportError:
        # Return a minimal JPEG header if PIL is unavailable
        return b"\xff\xd8\xff\xe0" + b"\x00" * 500 + b"\xff\xd9"


def _minimal_png_bytes() -> bytes:
    """Return minimal valid PNG bytes for testing."""
    try:
        from PIL import Image as PILImage

        img = PILImage.new("RGB", (64, 64), color=(200, 100, 50))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except ImportError:
        # PNG signature + minimal chunks
        return b"\x89PNG\r\n\x1a\n" + b"\x00" * 100


# ---------------------------------------------------------------------------
# Gemini Vision service unit tests
# ---------------------------------------------------------------------------

def test_confidence_classification_high():
    """Confidence >= 0.70 should classify as 'high'."""
    svc = DiagnosisService()
    assert svc._classify_confidence(0.85) == "high"
    assert svc._classify_confidence(0.70) == "high"


def test_confidence_classification_medium():
    """Confidence between 0.40 and 0.70 should classify as 'medium'."""
    svc = DiagnosisService()
    assert svc._classify_confidence(0.55) == "medium"
    assert svc._classify_confidence(0.40) == "medium"


def test_confidence_classification_uncertain():
    """Confidence < 0.40 should classify as 'uncertain'."""
    svc = DiagnosisService()
    assert svc._classify_confidence(0.39) == "uncertain"
    assert svc._classify_confidence(0.0) == "uncertain"


@pytest.mark.asyncio
async def test_gemini_mock_response_when_no_api_key():
    """When OPENROUTER_API_KEY is empty, _call_gemini_vision returns mock."""
    svc = DiagnosisService()
    with patch("app.diagnosis.service.settings") as mock_settings:
        mock_settings.OPENROUTER_API_KEY = ""
        result = await svc._call_gemini_vision(b"fake image bytes")
    assert result["disease_detected"] is not None
    assert "mock" in result["disease_detected"].lower()
    assert result["confidence_score"] == 0.55
    assert result["consult_expert"] is True


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_diagnosis_unauthenticated(client):
    """Diagnosis endpoint requires authentication."""
    resp = await client.post("/api/v1/diagnosis/predict")
    assert resp.status_code in (401, 422)


@pytest.mark.asyncio
async def test_diagnosis_no_file_returns_422(client, farmer_user):
    """Diagnosis endpoint without file returns 422 validation error."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    resp = await client.post(
        "/api/v1/diagnosis/predict",
        headers=_auth(token),
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_diagnosis_with_valid_image(client, farmer_user):
    """Diagnosis endpoint accepts a valid JPEG image and returns predictions."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    image_bytes = _minimal_jpeg_bytes()

    resp = await client.post(
        "/api/v1/diagnosis/predict",
        headers=_auth(token),
        files={"file": ("test.jpg", image_bytes, "image/jpeg")},
    )
    # Either 200 (success) or 201 is acceptable
    assert resp.status_code in (200, 201)
    data = resp.json()
    # Should contain prediction results
    assert "predictions" in data or "top_prediction" in data or "label" in data


@pytest.mark.asyncio
async def test_diagnosis_with_png_image(client, farmer_user):
    """Diagnosis endpoint accepts PNG images as well as JPEG."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")
    image_bytes = _minimal_png_bytes()

    resp = await client.post(
        "/api/v1/diagnosis/predict",
        headers=_auth(token),
        files={"file": ("test.png", image_bytes, "image/png")},
    )
    assert resp.status_code in (200, 201)


@pytest.mark.asyncio
async def test_diagnosis_invalid_file_type_rejected(client, farmer_user):
    """Non-image file type should be rejected with 4xx."""
    token = create_access_token(user_id=farmer_user.id, role="farmer")

    resp = await client.post(
        "/api/v1/diagnosis/predict",
        headers=_auth(token),
        files={"file": ("document.pdf", b"%PDF-1.4 fake pdf content", "application/pdf")},
    )
    assert resp.status_code in (400, 415, 422)
