"""add tos acceptance columns to users

Supports the trilingual Terms of Use (see TOS_AUDIT.md). Additive only — two
nullable columns on users, no new tables, no backfill.

The absence of a backfill is load-bearing, not an oversight: NULL is the signal
that triggers the blocking re-acceptance modal for every pre-existing non-admin
user. Backfilling would silently record acceptance nobody gave.

Revision ID: 014
Revises: 013
Create Date: 2026-07-19
"""

import sqlalchemy as sa
from alembic import op

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("tos_accepted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("tos_version", sa.String(32), nullable=True),
    )


def downgrade() -> None:
    # NOTE: dropping these destroys the acceptance record for every user who
    # already accepted. A rollback should normally revert application code and
    # LEAVE these columns in place (see the plan's Rollback section).
    op.drop_column("users", "tos_version")
    op.drop_column("users", "tos_accepted_at")
