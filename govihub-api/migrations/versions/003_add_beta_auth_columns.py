"""add_beta_auth_columns

Revision ID: 003
Revises: 002
Create Date: 2026-03-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add beta auth columns to users table
    op.add_column("users", sa.Column("username", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(255), nullable=True))
    op.add_column(
        "users",
        sa.Column("auth_provider", sa.String(20), nullable=True, server_default="beta"),
    )

    # Unique index on username (partial — only where username is not null)
    op.create_index(
        "ix_users_username_unique",
        "users",
        ["username"],
        unique=True,
        postgresql_where=sa.text("username IS NOT NULL"),
    )

    # Create beta_feedback table
    op.create_table(
        "beta_feedback",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("page_url", sa.Text, nullable=True),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("rating", sa.SmallInteger, nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("beta_feedback")
    op.drop_index("ix_users_username_unique", table_name="users")
    op.drop_column("users", "auth_provider")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "username")
