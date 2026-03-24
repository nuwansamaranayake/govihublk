"""initial_schema

Revision ID: 001
Revises:
Create Date: 2026-03-23
"""
from typing import Sequence, Union

import geoalchemy2
import pgvector
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "postgis"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "vector"')

    # Enums
    user_role = postgresql.ENUM("farmer", "buyer", "supplier", "admin", name="user_role", create_type=True)
    crop_category = postgresql.ENUM("vegetable", "fruit", "grain", "pulse", "spice", name="crop_category", create_type=True)
    listing_status = postgresql.ENUM("draft", "active", "matched", "sold", "expired", "cancelled", name="listing_status", create_type=True)
    demand_status = postgresql.ENUM("draft", "active", "matched", "fulfilled", "expired", "cancelled", name="demand_status", create_type=True)
    match_status = postgresql.ENUM("proposed", "accepted_farmer", "accepted_buyer", "confirmed", "in_transit", "fulfilled", "disputed", "cancelled", "expired", name="match_status", create_type=True)
    diagnosis_status = postgresql.ENUM("pending", "processing", "completed", "failed", name="diagnosis_status", create_type=True)
    user_feedback_type = postgresql.ENUM("helpful", "not_helpful", "incorrect", name="user_feedback_type", create_type=True)
    supply_category = postgresql.ENUM("seeds", "fertilizer", "pesticide", "equipment", "tools", "irrigation", "other", name="supply_category", create_type=True)
    supply_status = postgresql.ENUM("active", "out_of_stock", "discontinued", name="supply_status", create_type=True)
    notification_type = postgresql.ENUM("match_found", "match_accepted", "match_confirmed", "match_fulfilled", "price_alert", "weather_alert", "diagnosis_complete", "system_message", name="notification_type", create_type=True)
    notification_channel = postgresql.ENUM("push", "sms", "in_app", name="notification_channel", create_type=True)

    user_role.create(op.get_bind(), checkfirst=True)
    crop_category.create(op.get_bind(), checkfirst=True)
    listing_status.create(op.get_bind(), checkfirst=True)
    demand_status.create(op.get_bind(), checkfirst=True)
    match_status.create(op.get_bind(), checkfirst=True)
    diagnosis_status.create(op.get_bind(), checkfirst=True)
    user_feedback_type.create(op.get_bind(), checkfirst=True)
    supply_category.create(op.get_bind(), checkfirst=True)
    supply_status.create(op.get_bind(), checkfirst=True)
    notification_type.create(op.get_bind(), checkfirst=True)
    notification_channel.create(op.get_bind(), checkfirst=True)

    # -- Users --
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("phone", sa.String(20), unique=True, nullable=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("language", sa.String(5), server_default="si"),
        sa.Column("location", geoalchemy2.Geography("POINT", srid=4326), nullable=True),
        sa.Column("gn_division", sa.String(100), nullable=True),
        sa.Column("ds_division", sa.String(100), nullable=True),
        sa.Column("district", sa.String(100), nullable=True),
        sa.Column("province", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("is_verified", sa.Boolean, server_default="false"),
        sa.Column("avatar_url", sa.Text, nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_district", "users", ["district"])

    # -- Profiles --
    op.create_table(
        "farmer_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("farm_size_acres", sa.Float, nullable=True),
        sa.Column("primary_crops", postgresql.JSONB, nullable=True),
        sa.Column("irrigation_type", sa.String(50), nullable=True),
        sa.Column("cooperative", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "buyer_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("business_name", sa.String(255), nullable=True),
        sa.Column("business_type", sa.String(100), nullable=True),
        sa.Column("preferred_districts", postgresql.JSONB, nullable=True),
        sa.Column("preferred_radius_km", sa.Integer, server_default="50"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "supplier_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("business_name", sa.String(255), nullable=True),
        sa.Column("categories", postgresql.JSONB, nullable=True),
        sa.Column("coverage_area", postgresql.JSONB, nullable=True),
        sa.Column("contact_phone", sa.String(20), nullable=True),
        sa.Column("contact_whatsapp", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # -- Auth --
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(512), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_revoked", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token", "refresh_tokens", ["token"])

    op.create_table(
        "google_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("google_id", sa.String(255), unique=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("picture_url", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_google_accounts_google_id", "google_accounts", ["google_id"])

    # -- Crop Taxonomy --
    op.create_table(
        "crop_taxonomy",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("code", sa.String(20), unique=True, nullable=False),
        sa.Column("name_en", sa.String(100), nullable=False),
        sa.Column("name_si", sa.String(100), nullable=False),
        sa.Column("name_ta", sa.String(100), nullable=True),
        sa.Column("category", crop_category, nullable=False),
        sa.Column("season", postgresql.JSONB, nullable=True),
        sa.Column("avg_yield_kg", sa.Float, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_crop_taxonomy_code", "crop_taxonomy", ["code"])

    # -- Harvest Listings --
    op.create_table(
        "harvest_listings",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("crop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crop_taxonomy.id"), nullable=False),
        sa.Column("variety", sa.String(100), nullable=True),
        sa.Column("quantity_kg", sa.Numeric(10, 2), nullable=False),
        sa.Column("price_per_kg", sa.Numeric(10, 2), nullable=True),
        sa.Column("min_price_per_kg", sa.Numeric(10, 2), nullable=True),
        sa.Column("quality_grade", sa.String(10), nullable=True),
        sa.Column("harvest_date", sa.Date, nullable=True),
        sa.Column("available_from", sa.Date, nullable=True),
        sa.Column("available_until", sa.Date, nullable=True),
        sa.Column("location", geoalchemy2.Geography("POINT", srid=4326), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("images", postgresql.JSONB, nullable=True),
        sa.Column("status", listing_status, server_default="draft"),
        sa.Column("is_organic", sa.Boolean, server_default="false"),
        sa.Column("delivery_available", sa.Boolean, server_default="false"),
        sa.Column("delivery_radius_km", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('draft', 'active', 'matched', 'sold', 'expired', 'cancelled')", name="harvest_listing_status_check"),
    )
    op.create_index("ix_harvest_listings_farmer_id", "harvest_listings", ["farmer_id"])
    op.create_index("ix_harvest_listings_crop_id", "harvest_listings", ["crop_id"])
    op.create_index("ix_harvest_listings_status", "harvest_listings", ["status"])
    op.create_index("ix_harvest_listings_crop_status", "harvest_listings", ["crop_id", "status"])
    op.create_index("ix_harvest_listings_farmer_status", "harvest_listings", ["farmer_id", "status"])

    # -- Demand Postings --
    op.create_table(
        "demand_postings",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("buyer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("crop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crop_taxonomy.id"), nullable=False),
        sa.Column("variety", sa.String(100), nullable=True),
        sa.Column("quantity_kg", sa.Numeric(10, 2), nullable=False),
        sa.Column("max_price_per_kg", sa.Numeric(10, 2), nullable=True),
        sa.Column("quality_grade", sa.String(10), nullable=True),
        sa.Column("needed_by", sa.Date, nullable=True),
        sa.Column("location", geoalchemy2.Geography("POINT", srid=4326), nullable=True),
        sa.Column("radius_km", sa.Integer, server_default="50"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("status", demand_status, server_default="draft"),
        sa.Column("is_recurring", sa.Boolean, server_default="false"),
        sa.Column("recurrence_pattern", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('draft', 'active', 'matched', 'fulfilled', 'expired', 'cancelled')", name="demand_posting_status_check"),
    )
    op.create_index("ix_demand_postings_buyer_id", "demand_postings", ["buyer_id"])
    op.create_index("ix_demand_postings_crop_id", "demand_postings", ["crop_id"])
    op.create_index("ix_demand_postings_status", "demand_postings", ["status"])
    op.create_index("ix_demand_postings_crop_status", "demand_postings", ["crop_id", "status"])
    op.create_index("ix_demand_postings_buyer_status", "demand_postings", ["buyer_id", "status"])

    # -- Matches --
    op.create_table(
        "matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("harvest_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("harvest_listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("demand_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("demand_postings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Float, nullable=False),
        sa.Column("score_breakdown", postgresql.JSONB, nullable=True),
        sa.Column("status", match_status, server_default="proposed"),
        sa.Column("agreed_price_per_kg", sa.Float, nullable=True),
        sa.Column("agreed_quantity_kg", sa.Float, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fulfilled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("harvest_id", "demand_id", name="uq_matches_harvest_demand"),
        sa.CheckConstraint(
            "status IN ('proposed', 'accepted_farmer', 'accepted_buyer', 'confirmed', "
            "'in_transit', 'fulfilled', 'disputed', 'cancelled', 'expired')",
            name="match_status_check",
        ),
    )
    op.create_index("ix_matches_harvest_id", "matches", ["harvest_id"])
    op.create_index("ix_matches_demand_id", "matches", ["demand_id"])
    op.create_index("ix_matches_status", "matches", ["status"])
    op.create_index("ix_matches_harvest_status", "matches", ["harvest_id", "status"])
    op.create_index("ix_matches_demand_status", "matches", ["demand_id", "status"])

    # -- Crop Diagnoses --
    op.create_table(
        "crop_diagnoses",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("image_url", sa.Text, nullable=False),
        sa.Column("crop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crop_taxonomy.id"), nullable=True),
        sa.Column("diagnosis_result", postgresql.JSONB, nullable=True),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("disease_name", sa.String(255), nullable=True),
        sa.Column("treatment_advice", sa.Text, nullable=True),
        sa.Column("model_version", sa.String(50), nullable=True),
        sa.Column("status", diagnosis_status, server_default="pending"),
        sa.Column("user_feedback", user_feedback_type, nullable=True),
        sa.Column("language", sa.String(5), server_default="si"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "user_feedback IN ('helpful', 'not_helpful', 'incorrect') OR user_feedback IS NULL",
            name="diagnosis_feedback_check",
        ),
    )
    op.create_index("ix_crop_diagnoses_user", "crop_diagnoses", ["user_id"])

    # -- Knowledge Chunks --
    op.create_table(
        "knowledge_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("source", sa.String(255), nullable=False),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("language", sa.String(5), server_default="en"),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("tags", postgresql.JSONB, nullable=True),
        sa.Column("embedding", pgvector.sqlalchemy.Vector(384), nullable=True),
        sa.Column("metadata", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_knowledge_chunks_category", "knowledge_chunks", ["category"])
    # IVFFlat index requires data to exist first; create after seeding
    # op.execute("CREATE INDEX ix_knowledge_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)")

    # -- Advisory Questions --
    op.create_table(
        "advisory_questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_text", sa.Text, nullable=False),
        sa.Column("answer_text", sa.Text, nullable=True),
        sa.Column("chunks_used", postgresql.JSONB, nullable=True),
        sa.Column("language", sa.String(5), server_default="si"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_advisory_questions_user_id", "advisory_questions", ["user_id"])

    # -- Supply Listings --
    op.create_table(
        "supply_listings",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("name_si", sa.String(255), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", supply_category, nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=True),
        sa.Column("unit", sa.String(20), nullable=True),
        sa.Column("stock_quantity", sa.Integer, nullable=True),
        sa.Column("images", postgresql.JSONB, nullable=True),
        sa.Column("location", geoalchemy2.Geography("POINT", srid=4326), nullable=True),
        sa.Column("delivery_available", sa.Boolean, server_default="false"),
        sa.Column("delivery_radius_km", sa.Integer, nullable=True),
        sa.Column("status", supply_status, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_supply_listings_supplier_id", "supply_listings", ["supplier_id"])
    op.create_index("ix_supply_listings_category", "supply_listings", ["category"])
    op.create_index("ix_supply_listings_category_status", "supply_listings", ["category", "status"])
    op.execute("CREATE INDEX ix_supply_listings_location ON supply_listings USING gist (location)")

    # -- Notifications --
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", notification_type, nullable=False),
        sa.Column("channel", notification_channel, server_default="in_app"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("data", postgresql.JSONB, nullable=True),
        sa.Column("is_read", sa.Boolean, server_default="false"),
        sa.Column("is_sent", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_read", "notifications", ["user_id", "is_read"])
    op.create_index("ix_notifications_user_created", "notifications", ["user_id", "created_at"])

    op.create_table(
        "notification_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("push_enabled", sa.Boolean, server_default="true"),
        sa.Column("sms_enabled", sa.Boolean, server_default="true"),
        sa.Column("match_alerts", sa.Boolean, server_default="true"),
        sa.Column("weather_alerts", sa.Boolean, server_default="true"),
        sa.Column("price_alerts", sa.Boolean, server_default="true"),
        sa.Column("quiet_hours_start", sa.Time, nullable=True),
        sa.Column("quiet_hours_end", sa.Time, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # -- Price History --
    op.create_table(
        "price_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("crop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crop_taxonomy.id", ondelete="CASCADE"), nullable=False),
        sa.Column("market_name", sa.String(255), nullable=False),
        sa.Column("price_per_kg", sa.Numeric(10, 2), nullable=False),
        sa.Column("unit", sa.String(20), server_default="LKR"),
        sa.Column("recorded_date", sa.Date, nullable=False),
        sa.Column("source", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_price_history_crop_date", "price_history", ["crop_id", "recorded_date"])
    op.create_index("ix_price_history_market", "price_history", ["market_name"])

    # -- Weather Cache --
    op.create_table(
        "weather_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("gn_division", sa.String(100), nullable=False),
        sa.Column("forecast_data", postgresql.JSONB, nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_weather_cache_gn", "weather_cache", ["gn_division"])
    op.create_index("ix_weather_cache_expires", "weather_cache", ["expires_at"])


def downgrade() -> None:
    op.drop_table("weather_cache")
    op.drop_table("price_history")
    op.drop_table("notification_preferences")
    op.drop_table("notifications")
    op.drop_table("supply_listings")
    op.drop_table("advisory_questions")
    op.drop_table("knowledge_chunks")
    op.drop_table("crop_diagnoses")
    op.drop_table("matches")
    op.drop_table("demand_postings")
    op.drop_table("harvest_listings")
    op.drop_table("crop_taxonomy")
    op.drop_table("google_accounts")
    op.drop_table("refresh_tokens")
    op.drop_table("supplier_profiles")
    op.drop_table("buyer_profiles")
    op.drop_table("farmer_profiles")
    op.drop_table("users")

    # Drop enums
    for enum_name in [
        "notification_channel", "notification_type", "supply_status", "supply_category",
        "user_feedback_type", "diagnosis_status", "match_status", "demand_status",
        "listing_status", "crop_category", "user_role",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
