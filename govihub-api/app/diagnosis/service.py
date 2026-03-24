"""GoviHub Diagnosis Service — Image upload, CNN inference, advice generation, CRUD."""

import uuid
from typing import Optional
from uuid import UUID

import structlog
from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.diagnosis.cnn import cnn_model
from app.diagnosis.models import CropDiagnosis, DiagnosisStatus, UserFeedback
from app.exceptions import NotFoundError, ValidationError
from app.utils.openrouter import openrouter_client
from app.utils.storage import storage_service

logger = structlog.get_logger()

# Confidence thresholds for routing
HIGH_CONFIDENCE_THRESHOLD = 0.70
LOW_CONFIDENCE_THRESHOLD = 0.40

# Sinhala fallback advice when LLM is unavailable
FALLBACK_ADVICE_SI = "කරුණාකර ඔබේ ගොවිපළ උපදේශකයා හමුවන්න"

AGRICULTURAL_ADVISOR_SYSTEM_PROMPT = (
    "ඔබ ශ්‍රී ලංකාවේ ගොවීන්ට උපදෙස් දෙන පළිබෝධ හා රෝග විශේෂඥ කෘෂිකාර්මික උපදේශකයෙකි. "
    "ඔබ සිංහල භාෂාවෙන් පමණක් ප්‍රතිචාර දක්වයි. "
    "ප්‍රතිකාර ක්‍රමය පිළිබඳ සරල, ප්‍රායෝගික උපදෙස් 3-5 ලක්ෂ්‍ය ලෙස ලබා දෙන්න. "
    "ශ්‍රී ලංකාවේ ගොවීන්ට ලබා ගත හැකි දේශීය ප්‍රතිකාර ක්‍රම කෙරෙහි අවධානය යොමු කරන්න. "
    "ප්‍රතිකාර හෝ රසායනික ද්‍රව්‍ය නිර්දේශ කරන්නේ නම් ශ්‍රී ලංකාවේ ලබා ගත හැකි ඒවා සඳහන් කරන්න."
)


class DiagnosisService:
    """Business logic for crop disease diagnosis."""

    # ------------------------------------------------------------------
    # Core diagnosis flow
    # ------------------------------------------------------------------

    async def diagnose(
        self,
        db: AsyncSession,
        farmer_id: UUID,
        image_file: UploadFile,
        crop_id: Optional[UUID] = None,
    ) -> CropDiagnosis:
        """Upload image, run CNN, generate Sinhala advice, persist to DB.

        Confidence routing:
          >= 0.70  — high confidence, full Sinhala advice generated
          0.40–0.70 — medium confidence, advice with caveat
          < 0.40   — uncertain, generic referral advice
        """
        # 1. Validate and read file
        file_bytes = await image_file.read()
        content_type = image_file.content_type or "application/octet-stream"

        if not file_bytes:
            raise ValidationError(detail="Uploaded file is empty.")

        # 2. Upload to storage
        image_url = await storage_service.upload_image(
            file_bytes=file_bytes,
            content_type=content_type,
            folder="diagnoses",
        )

        # 3. Create DB record in pending state
        record = CropDiagnosis(
            user_id=farmer_id,
            crop_id=crop_id,
            image_url=image_url,
            status=DiagnosisStatus.processing,
            model_version=cnn_model.model_version,
            language="si",
        )
        db.add(record)
        await db.flush()  # get record.id without committing

        try:
            # 4. Run CNN inference
            predictions = cnn_model.predict(file_bytes)
            top_prediction = predictions[0] if predictions else {}
            disease_label: str = top_prediction.get("label", "Unknown")
            confidence: float = float(top_prediction.get("confidence", 0.0))

            # 5. Determine routing tier
            confidence_tier = self._classify_confidence(confidence)

            # 6. Resolve crop name from taxonomy if available
            crop_name: Optional[str] = None
            if crop_id:
                crop_name = await self._get_crop_name(db, crop_id)

            # 7. Generate Sinhala treatment advice
            advice = await self.generate_advice(
                classification=disease_label,
                crop_name=crop_name,
                confidence=confidence,
                confidence_tier=confidence_tier,
                language="si",
            )

            # 8. Update record with results
            record.disease_name = disease_label
            record.confidence = confidence
            record.diagnosis_result = {
                "top_predictions": predictions,
                "confidence_tier": confidence_tier,
            }
            record.treatment_advice = advice
            record.status = DiagnosisStatus.completed

            logger.info(
                "diagnosis_completed",
                record_id=str(record.id),
                disease=disease_label,
                confidence=confidence,
                tier=confidence_tier,
            )

        except Exception as exc:  # noqa: BLE001
            logger.error("diagnosis_failed", record_id=str(record.id), error=str(exc))
            record.status = DiagnosisStatus.failed

        await db.flush()
        return record

    async def generate_advice(
        self,
        classification: str,
        crop_name: Optional[str],
        confidence: float,
        confidence_tier: str = "high",
        language: str = "si",
    ) -> str:
        """Generate treatment advice via OpenRouter LLM.

        Returns a Sinhala fallback string on any failure.
        """
        crop_part = f"වගාව: {crop_name}" if crop_name else ""
        tier_note = {
            "high": "රෝගය ඉහළ විශ්වාසනීයතාවයකින් හඳුනා ගත හැකි විය.",
            "medium": "රෝගය මධ්‍යම විශ්වාසනීයතාවයකින් හඳුනා ගත හැකි විය. වෙනත් රෝගයක් ද විය හැකිය.",
            "uncertain": "රෝගය අනිශ්චිත ය. කෘෂිකාර්මික නිලධාරියෙකුගෙන් තහවුරු කර ගැනීම නිර්දේශ කෙරේ.",
        }.get(confidence_tier, "")

        user_message = (
            f"රෝගය/ගැටළුව: {classification}\n"
            f"{crop_part}\n"
            f"විශ්වාසනීයතා මට්ටම: {confidence:.0%}\n"
            f"{tier_note}\n\n"
            "ඉහත රෝගය සඳහා ප්‍රතිකාර ක්‍රමය සිංහලෙන් පැහැදිලි කරන්න."
        )

        try:
            response = await openrouter_client.chat(
                messages=[{"role": "user", "content": user_message}],
                system=AGRICULTURAL_ADVISOR_SYSTEM_PROMPT,
                temperature=0.3,
                max_tokens=500,
            )
            return response.content.strip()
        except Exception as exc:  # noqa: BLE001
            logger.warning("diagnosis_advice_llm_failed", error=str(exc))
            return FALLBACK_ADVICE_SI

    # ------------------------------------------------------------------
    # CRUD helpers
    # ------------------------------------------------------------------

    async def get_diagnosis(
        self,
        db: AsyncSession,
        diagnosis_id: UUID,
        farmer_id: UUID,
    ) -> CropDiagnosis:
        """Fetch a single diagnosis record owned by the requesting farmer."""
        stmt = select(CropDiagnosis).where(
            CropDiagnosis.id == diagnosis_id,
            CropDiagnosis.user_id == farmer_id,
        )
        result = await db.execute(stmt)
        record = result.scalar_one_or_none()
        if record is None:
            raise NotFoundError(detail="Diagnosis record not found.")
        return record

    async def list_diagnosis_history(
        self,
        db: AsyncSession,
        farmer_id: UUID,
        crop_id: Optional[UUID] = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[CropDiagnosis], int]:
        """Return paginated diagnosis history for a farmer.

        Returns:
            Tuple of (records list, total count).
        """
        filters = [CropDiagnosis.user_id == farmer_id]
        if crop_id:
            filters.append(CropDiagnosis.crop_id == crop_id)

        count_stmt = select(func.count()).select_from(CropDiagnosis).where(*filters)
        total_result = await db.execute(count_stmt)
        total: int = total_result.scalar_one()

        offset = (page - 1) * size
        data_stmt = (
            select(CropDiagnosis)
            .where(*filters)
            .order_by(CropDiagnosis.created_at.desc())
            .offset(offset)
            .limit(size)
        )
        data_result = await db.execute(data_stmt)
        records = list(data_result.scalars().all())

        return records, total

    async def submit_feedback(
        self,
        db: AsyncSession,
        diagnosis_id: UUID,
        farmer_id: UUID,
        feedback: str,
    ) -> CropDiagnosis:
        """Record farmer feedback on a diagnosis result."""
        record = await self.get_diagnosis(db, diagnosis_id, farmer_id)

        try:
            record.user_feedback = UserFeedback(feedback)
        except ValueError as exc:
            raise ValidationError(
                detail=f"Invalid feedback value: {feedback}",
                details={"allowed": [e.value for e in UserFeedback]},
            ) from exc

        await db.flush()
        logger.info(
            "diagnosis_feedback_submitted",
            record_id=str(diagnosis_id),
            feedback=feedback,
        )
        return record

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _classify_confidence(confidence: float) -> str:
        """Map a confidence score to a tier label."""
        if confidence >= HIGH_CONFIDENCE_THRESHOLD:
            return "high"
        if confidence >= LOW_CONFIDENCE_THRESHOLD:
            return "medium"
        return "uncertain"

    @staticmethod
    async def _get_crop_name(db: AsyncSession, crop_id: UUID) -> Optional[str]:
        """Look up the English crop name from crop_taxonomy."""
        try:
            from app.listings.models import CropTaxonomy

            stmt = select(CropTaxonomy.name_en).where(CropTaxonomy.id == crop_id)
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        except Exception as exc:  # noqa: BLE001
            logger.warning("diagnosis_crop_lookup_failed", crop_id=str(crop_id), error=str(exc))
            return None


# Module-level singleton
diagnosis_service = DiagnosisService()
