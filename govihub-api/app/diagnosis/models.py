"""GoviHub Diagnosis Model — CropDiagnosis."""

import enum
from typing import Optional

from sqlalchemy import CheckConstraint, Enum, Float, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DiagnosisStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class UserFeedback(str, enum.Enum):
    helpful = "helpful"
    not_helpful = "not_helpful"
    incorrect = "incorrect"


class CropDiagnosis(Base):
    __tablename__ = "crop_diagnoses"

    user_id: Mapped["UUID"] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    crop_id: Mapped[Optional["UUID"]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crop_taxonomy.id"), nullable=True,
    )
    diagnosis_result: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    disease_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    treatment_advice: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    model_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[DiagnosisStatus] = mapped_column(
        Enum(DiagnosisStatus, name="diagnosis_status", create_constraint=True),
        default=DiagnosisStatus.pending,
        server_default="pending",
    )
    user_feedback: Mapped[Optional[UserFeedback]] = mapped_column(
        Enum(UserFeedback, name="user_feedback_type", create_constraint=True),
        nullable=True,
    )
    language: Mapped[str] = mapped_column(String(5), default="si", server_default="si")

    # Relationships
    user: Mapped["app.users.models.User"] = relationship(foreign_keys=[user_id])
    crop: Mapped[Optional["app.listings.models.CropTaxonomy"]] = relationship(foreign_keys=[crop_id])

    __table_args__ = (
        CheckConstraint(
            "user_feedback IN ('helpful', 'not_helpful', 'incorrect') OR user_feedback IS NULL",
            name="diagnosis_feedback_check",
        ),
        Index("ix_crop_diagnoses_user", "user_id"),
    )
