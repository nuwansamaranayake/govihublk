"""Add advertisements and ad_events tables.

Revision ID: 010
Revises: 009
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "010"
down_revision = "009"


def upgrade() -> None:
    op.create_table(
        "advertisements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("title_si", sa.String(255), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("description_si", sa.Text, nullable=True),
        sa.Column("image_url", sa.Text, nullable=False),
        sa.Column("click_url", sa.Text, nullable=True),
        sa.Column("target_roles", JSONB, server_default=sa.text("'[\"farmer\",\"buyer\",\"supplier\"]'::jsonb")),
        sa.Column("target_districts", JSONB, server_default=sa.text("'[]'::jsonb")),
        sa.Column("starts_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("advertiser_name", sa.String(255), nullable=True),
        sa.Column("advertiser_contact", sa.String(255), nullable=True),
        sa.Column("display_order", sa.Integer, server_default=sa.text("0")),
        sa.Column("impression_count", sa.Integer, server_default=sa.text("0")),
        sa.Column("click_count", sa.Integer, server_default=sa.text("0")),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_ads_active", "advertisements", ["is_active", "starts_at", "ends_at"])
    op.create_index("idx_ads_order", "advertisements", ["display_order"])

    op.create_table(
        "ad_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("ad_id", UUID(as_uuid=True), sa.ForeignKey("advertisements.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("event_type", sa.String(20), nullable=False),
        sa.Column("user_role", sa.String(20), nullable=True),
        sa.Column("user_district", sa.String(100), nullable=True),
        sa.Column("page_url", sa.Text, nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column("ip_hash", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_ad_events_ad", "ad_events", ["ad_id", "event_type"])
    op.create_index("idx_ad_events_date", "ad_events", ["created_at"])


def downgrade() -> None:
    op.drop_table("ad_events")
    op.drop_table("advertisements")
