"""GoviHub Diagnosis Tests — Image validation, CNN prediction, confidence routing."""

from __future__ import annotations

import io
import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.auth.service import create_access_token
from app.diagnosis.cnn import CLASS_NAMES, CropDiseaseCNN, cnn_model


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
# CNN model unit tests
# ---------------------------------------------------------------------------

def test_class_names_count():
    """CNN model should have exactly 38 class labels."""
    assert len(CLASS_NAMES) == 38


def test_class_names_include_rice_diseases():
    """CLASS_NAMES must include the Sri Lanka-relevant rice diseases."""
    rice_diseases = [c for c in CLASS_NAMES if c.startswith("Rice___")]
    assert len(rice_diseases) >= 4


def test_class_names_include_tomato_diseases():
    """CLASS_NAMES must include common tomato diseases."""
    tomato = [c for c in CLASS_NAMES if c.startswith("Tomato___")]
    assert len(tomato) >= 5


def test_placeholder_predict_returns_top3():
    """Placeholder prediction returns exactly 3 results."""
    results = CropDiseaseCNN._placeholder_predict()
    assert len(results) == 3


def test_placeholder_predict_confidence_keys():
    """Each placeholder result has label and confidence keys."""
    results = CropDiseaseCNN._placeholder_predict()
    for r in results:
        assert "label" in r
        assert "confidence" in r


def test_placeholder_confidences_sum_to_less_than_one():
    """Top-3 placeholder confidences need not sum to 1 (top-k not full softmax)."""
    results = CropDiseaseCNN._placeholder_predict()
    total = sum(r["confidence"] for r in results)
    assert 0.0 < total <= 1.0


def test_placeholder_predict_in_placeholder_mode():
    """In placeholder mode, predict() delegates to _placeholder_predict."""
    model = CropDiseaseCNN()
    model._placeholder_mode = True

    results = model.predict(b"fake image bytes")
    assert len(results) == 3
    assert results[0]["label"] == "Rice___Leaf_Blast"


def test_confidence_ordering():
    """Predictions should be in descending confidence order."""
    results = CropDiseaseCNN._placeholder_predict()
    confs = [r["confidence"] for r in results]
    assert confs == sorted(confs, reverse=True)


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
