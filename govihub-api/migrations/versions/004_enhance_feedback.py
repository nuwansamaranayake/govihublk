"""enhance_feedback

Revision ID: 004
Revises: 003
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"

def upgrade():
    op.add_column("beta_feedback", sa.Column("category", sa.String(30), server_default="general"))
    op.add_column("beta_feedback", sa.Column("language", sa.String(5), nullable=True))
    op.add_column("beta_feedback", sa.Column("status", sa.String(20), server_default="new"))
    op.add_column("beta_feedback", sa.Column("admin_notes", sa.Text, nullable=True))
    op.add_column("beta_feedback", sa.Column("priority", sa.String(10), nullable=True))
    op.create_index("idx_feedback_category", "beta_feedback", ["category"])
    op.create_index("idx_feedback_status", "beta_feedback", ["status"])
    op.create_index("idx_feedback_created", "beta_feedback", ["created_at"])

def downgrade():
    op.drop_index("idx_feedback_created")
    op.drop_index("idx_feedback_status")
    op.drop_index("idx_feedback_category")
    op.drop_column("beta_feedback", "priority")
    op.drop_column("beta_feedback", "admin_notes")
    op.drop_column("beta_feedback", "status")
    op.drop_column("beta_feedback", "language")
    op.drop_column("beta_feedback", "category")
