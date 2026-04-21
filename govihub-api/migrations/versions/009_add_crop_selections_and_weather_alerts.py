"""Add farmer_crop_selections and weather_alerts tables.

Revision ID: 009
Revises: 008
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "009"
down_revision = "008"


def upgrade() -> None:
    # ── farmer_crop_selections ──────────────────────────────────
    op.create_table(
        "farmer_crop_selections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("crop_type", sa.String(50), nullable=False),
        sa.Column("growth_stage", sa.String(50), server_default="vegetative"),
        sa.Column("area_hectares", sa.Numeric(6, 2), nullable=True),
        sa.Column("is_primary", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "crop_type", name="uq_farmer_crops_user_crop"),
    )
    op.create_index("idx_farmer_crops_user", "farmer_crop_selections", ["user_id"])
    op.create_index("idx_farmer_crops_type", "farmer_crop_selections", ["crop_type"])

    # ── weather_alerts ──────────────────────────────────────────
    op.create_table(
        "weather_alerts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("crop_type", sa.String(50), nullable=False),
        sa.Column("alert_type", sa.String(50), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="info"),
        sa.Column("forecast_date", sa.Date(), nullable=False),
        sa.Column("message_si", sa.Text(), nullable=False),
        sa.Column("message_en", sa.Text(), nullable=True),
        sa.Column("weather_data", JSONB, nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW() + INTERVAL '3 days'")),
    )
    op.create_index("idx_alerts_user_unread", "weather_alerts", ["user_id", "is_read"],
                     postgresql_where=sa.text("NOT is_read"))
    op.create_index("idx_alerts_expiry", "weather_alerts", ["expires_at"])
    op.create_index("idx_alerts_user_date", "weather_alerts", ["user_id", sa.text("created_at DESC")])


def downgrade() -> None:
    op.drop_table("weather_alerts")
    op.drop_table("farmer_crop_selections")
