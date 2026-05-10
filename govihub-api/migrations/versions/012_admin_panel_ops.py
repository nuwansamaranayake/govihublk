"""Admin panel operations — soft-delete timestamp + listing moderation columns.

Adds:
  - users.deleted_at (nullable timestamptz) — paired with the existing is_active
    flag so the admin panel can distinguish "deactivated" (still in DB,
    is_active=false) from "removed by admin" (deleted_at set).
  - harvest_listings, demand_postings, supply_listings:
      removal_reason (text), removed_by (uuid -> users.id), removed_at (timestamptz)
    The status enum is intentionally NOT extended — moderation is signalled by
    removed_at IS NOT NULL, leaving the lifecycle enums untouched.

Revision ID: 012
Revises: 011
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "012"
down_revision = "011"


_LISTING_TABLES = ("harvest_listings", "demand_postings", "supply_listings")


def upgrade() -> None:
    # users.deleted_at — soft-delete marker
    op.add_column(
        "users",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_users_deleted_at", "users", ["deleted_at"]
    )

    # Listing moderation trio. removed_by FK is ON DELETE SET NULL so that
    # deleting an admin user (rare; should never happen) does not break the
    # audit trail of past removals — the removal record stays, the actor
    # reference goes null.
    for table in _LISTING_TABLES:
        op.add_column(
            table,
            sa.Column("removal_reason", sa.Text(), nullable=True),
        )
        op.add_column(
            table,
            sa.Column("removed_by", UUID(as_uuid=True), nullable=True),
        )
        op.add_column(
            table,
            sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_foreign_key(
            f"fk_{table}_removed_by_users",
            table,
            "users",
            ["removed_by"],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_index(
            f"ix_{table}_removed_at", table, ["removed_at"]
        )


def downgrade() -> None:
    for table in _LISTING_TABLES:
        op.drop_index(f"ix_{table}_removed_at", table_name=table)
        op.drop_constraint(f"fk_{table}_removed_by_users", table, type_="foreignkey")
        op.drop_column(table, "removed_at")
        op.drop_column(table, "removed_by")
        op.drop_column(table, "removal_reason")

    op.drop_index("ix_users_deleted_at", table_name="users")
    op.drop_column("users", "deleted_at")
