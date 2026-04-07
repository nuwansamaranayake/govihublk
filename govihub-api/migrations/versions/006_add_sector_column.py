"""Add sector column to key marketplace tables.

Enables multi-tenant filtering by sector (e.g. 'spices', 'general').

Revision ID: 006
Revises: 005
"""

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column("users", sa.Column("sector", sa.String(50), server_default="general", nullable=True))
    op.add_column("harvest_listings", sa.Column("sector", sa.String(50), server_default="general", nullable=True))
    op.add_column("demand_postings", sa.Column("sector", sa.String(50), server_default="general", nullable=True))
    op.add_column("matches", sa.Column("sector", sa.String(50), server_default="general", nullable=True))

    op.create_index("ix_users_sector", "users", ["sector"])
    op.create_index("ix_harvest_listings_sector", "harvest_listings", ["sector"])
    op.create_index("ix_demand_postings_sector", "demand_postings", ["sector"])
    op.create_index("ix_matches_sector", "matches", ["sector"])


def downgrade() -> None:
    op.drop_index("ix_matches_sector", table_name="matches")
    op.drop_index("ix_demand_postings_sector", table_name="demand_postings")
    op.drop_index("ix_harvest_listings_sector", table_name="harvest_listings")
    op.drop_index("ix_users_sector", table_name="users")

    op.drop_column("matches", "sector")
    op.drop_column("demand_postings", "sector")
    op.drop_column("harvest_listings", "sector")
    op.drop_column("users", "sector")
