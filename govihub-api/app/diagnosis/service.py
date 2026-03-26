"""GoviHub Diagnosis Service — Image upload, Gemini Vision inference, advice generation, CRUD."""

import base64
import json
import uuid
from typing import Optional
from uuid import UUID

import httpx
import structlog
from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
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

DIAGNOSIS_SYSTEM_PROMPT = """You are an expert agricultural plant pathologist specializing in Sri Lankan crops.

A farmer has uploaded a photo of their crop for disease diagnosis.

INSTRUCTIONS:
1. Identify the crop in the image (rice/paddy, tomato, chili, onion, beans, brinjal, etc.)
2. Identify any visible disease, pest damage, or nutrient deficiency
3. Rate your confidence: high (>70%), medium (40-70%), or low (<40%)
4. If confident: name the disease and provide practical treatment advice
5. If uncertain: say so honestly and recommend consulting an extension officer
6. Provide treatment advice using locally available inputs in Sri Lanka
7. Reference Department of Agriculture (DOA) recommendations where applicable

RESPOND IN THIS EXACT JSON FORMAT:
{
  "crop_detected": "Rice (Paddy)",
  "disease_detected": "Rice Blast (Pyricularia oryzae)",
  "confidence": "high",
  "confidence_score": 0.85,
  "description": "Brown diamond-shaped lesions visible on leaves...",
  "treatment": "Apply Tricyclazole 75% WP at 0.6g/L as foliar spray...",
  "prevention": "Use resistant varieties (Bg 352, Bg 358)...",
  "severity": "moderate",
  "consult_expert": false,
  "advice_sinhala": "ව්\u200dයාධිය: කුරුලු පුල්ලි (Rice Blast)..."
}

For the advice_sinhala field: Write the COMPLETE diagnosis and treatment advice in natural spoken Sinhala. Use vocabulary that dry zone farmers in Anuradhapura/Polonnaruwa would understand. Include: what the disease is, how serious it is, what to do right now, and how to prevent it in the future. Keep it under 200 words.

If the image is NOT a plant/crop photo, respond with:
{
  "crop_detected": null,
  "disease_detected": null,
  "confidence": "none",
  "confidence_score": 0,
  "description": "This does not appear to be a photo of a crop or plant.",
  "treatment": null,
  "prevention": null,
  "severity": null,
  "consult_expert": false,
  "advice_sinhala": "මෙය බෝග ඡායාරූපයක් ලෙස හඳුනාගත නොහැක."
}"""


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
        crop_type: Optional[str] = None,
    ) -> CropDiagnosis:
        """Upload image, call Gemini Vision for diagnosis, persist to DB.

        Uses Gemini 2.0 Flash via OpenRouter to identify crop diseases
        and generate treatment advice in both English and Sinhala.
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
            model_version="gemini-2.0-flash-001",
            language="si",
        )
        db.add(record)
        await db.flush()  # get record.id without committing

        try:
            # 4. Resolve crop name from taxonomy or free-text crop_type
            crop_name: Optional[str] = crop_type
            if not crop_name and crop_id:
                crop_name = await self._get_crop_name(db, crop_id)

            # 5. Call Gemini Vision for diagnosis
            diagnosis = await self._call_gemini_vision(file_bytes, crop_name)

            # 6. Update record with Gemini results
            record.disease_name = diagnosis.get("disease_detected")
            record.confidence = float(diagnosis.get("confidence_score", 0))
            record.diagnosis_result = diagnosis  # full Gemini response in JSONB
            record.treatment_advice = diagnosis.get("advice_sinhala") or diagnosis.get("treatment")
            record.status = DiagnosisStatus.completed

            logger.info(
                "diagnosis_completed",
                record_id=str(record.id),
                disease=record.disease_name,
                confidence=record.confidence,
                crop_detected=diagnosis.get("crop_detected"),
                model="gemini-2.0-flash-001",
            )

        except Exception as exc:  # noqa: BLE001
            logger.error("diagnosis_failed", record_id=str(record.id), error=str(exc))
            record.status = DiagnosisStatus.failed

        await db.flush()
        return record

    async def _call_gemini_vision(self, image_bytes: bytes, crop_type: str = None) -> dict:
        """Send image to Gemini 2.0 Flash via OpenRouter for diagnosis."""
        if not settings.OPENROUTER_API_KEY:
            # Return mock response when no API key configured
            return {
                "crop_detected": "Rice (Paddy)",
                "disease_detected": "Rice Leaf Blast (mock - no API key)",
                "confidence": "medium",
                "confidence_score": 0.55,
                "description": "Mock diagnosis - configure OPENROUTER_API_KEY for real results.",
                "treatment": "This is a mock response. Configure OpenRouter API key for real diagnosis.",
                "prevention": "Configure OPENROUTER_API_KEY in .env for real diagnosis.",
                "severity": "unknown",
                "consult_expert": True,
                "advice_sinhala": "මෙය පරීක්ෂණ ප්\u200dරතිචාරයකි. සත්\u200dය රෝග විනිශ්චය සඳහා OPENROUTER_API_KEY සකසන්න.",
            }

        base64_image = base64.b64encode(image_bytes).decode("utf-8")

        # Detect image type
        if image_bytes[:4] == b"\x89PNG":
            media_type = "image/png"
        elif image_bytes[:2] == b"\xff\xd8":
            media_type = "image/jpeg"
        else:
            media_type = "image/jpeg"

        user_message = "Diagnose this crop image."
        if crop_type:
            user_message += f" The farmer says this is: {crop_type}"

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "google/gemini-2.0-flash-001",
                    "messages": [
                        {"role": "system", "content": DIAGNOSIS_SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:{media_type};base64,{base64_image}"
                                    },
                                },
                                {"type": "text", "text": user_message},
                            ],
                        },
                    ],
                    "max_tokens": 1500,
                    "temperature": 0.3,
                },
            )
            response.raise_for_status()

        result = response.json()
        text = result["choices"][0]["message"]["content"]

        # Parse JSON from response (strip markdown fences if present)
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text.rsplit("\n", 1)[0]
        if text.startswith("json"):
            text = text[4:].strip()

        return json.loads(text)

    async def generate_advice(
        self,
        classification: str,
        crop_name: Optional[str],
        confidence: float,
        confidence_tier: str = "high",
        language: str = "si",
    ) -> str:
        """Generate treatment advice via OpenRouter LLM.

        .. deprecated::
            This method is retained for backward compatibility but is no longer
            used by the main diagnose() flow. Gemini Vision now generates advice
            directly as part of the diagnosis response.

        Returns a Sinhala fallback string on any failure.
        """
        crop_part = f"වගාව: {crop_name}" if crop_name else ""
        tier_note = {
            "high": "රෝගය ඉහළ විශ්වාසනීයතාවයකින් හඳුනා ගත හැකි විය.",
            "medium": "රෝගය මධ්\u200dයම විශ්වාසනීයතාවයකින් හඳුනා ගත හැකි විය. වෙනත් රෝගයක් ද විය හැකිය.",
            "uncertain": "රෝගය අනිශ්චිත ය. කෘෂිකාර්මික නිලධාරියෙකුගෙන් තහවුරු කර ගැනීම නිර්දේශ කෙරේ.",
        }.get(confidence_tier, "")

        user_message = (
            f"රෝගය/ගැටළුව: {classification}\n"
            f"{crop_part}\n"
            f"විශ්වාසනීයතා මට්ටම: {confidence:.0%}\n"
            f"{tier_note}\n\n"
            "ඉහත රෝගය සඳහා ප්\u200dරතිකාර ක්\u200dරමය සිංහලෙන් පැහැදිලි කරන්න."
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
