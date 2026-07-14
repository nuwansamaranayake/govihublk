"""Tests for GET /diagnosis/history list serializer.

Regression guard for the bug where every completed diagnosis showed "Analysis failed":
the list serializer must expose disease_name AND status so the card can show the real
name and only flag genuine failures. See DIAGNOSIS_HISTORY_AUDIT.md.
"""

import uuid

import pytest

from app.auth.service import create_access_token
from app.diagnosis.models import CropDiagnosis, DiagnosisStatus


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id=user.id, role=user.role.value)}"}


@pytest.mark.asyncio
async def test_history_exposes_disease_name_and_status(client, db_session, farmer_user):
    farmer_user.phone = "+94770000001"  # require_role('farmer') -> require_complete_profile needs a phone
    db_session.add_all([
        CropDiagnosis(
            id=uuid.uuid4(), user_id=farmer_user.id, image_url="http://img/1.jpg",
            disease_name="Leaf Blotch (Taphrina maculans)", confidence=0.88,
            status=DiagnosisStatus.completed,
        ),
        CropDiagnosis(
            id=uuid.uuid4(), user_id=farmer_user.id, image_url="http://img/2.jpg",
            disease_name=None, confidence=None, status=DiagnosisStatus.failed,
        ),
    ])
    await db_session.flush()

    res = await client.get("/api/v1/diagnosis/history", headers=_auth(farmer_user))
    assert res.status_code == 200, res.text
    items = res.json()["data"]
    assert len(items) == 2
    for it in items:  # every field the card reads must be present
        assert {"disease_name", "confidence", "status", "created_at"} <= set(it)
    by_status = {it["status"]: it for it in items}
    # completed record carries the real name + confidence (was the mislabeled case)
    assert by_status["completed"]["disease_name"] == "Leaf Blotch (Taphrina maculans)"
    assert by_status["completed"]["confidence"] == 0.88
    # a genuinely failed record is distinguishable and has no disease name
    assert by_status["failed"]["disease_name"] is None
