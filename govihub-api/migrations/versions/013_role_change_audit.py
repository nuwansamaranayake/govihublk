"""add role_changes audit table + users.last_role_change_at

Supports self-service role change (see ROLE_CHANGE_AUDIT.md). Additive only —
one nullable column on users + one new table. No destructive down-migration data loss.

Revision ID: 013
Revises: 012
Create Date: 2026-07-14
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("last_role_change_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "role_changes",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"), nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("old_role", sa.String(length=20), nullable=False),
        sa.Column("new_role", sa.String(length=20), nullable=False),
        sa.Column("listings_deactivated", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_role_changes_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_role_changes")),
    )
    op.create_index(op.f("ix_role_changes_user_id"), "role_changes", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_role_changes_user_id"), table_name="role_changes")
    op.drop_table("role_changes")
    op.drop_column("users", "last_role_change_at")
