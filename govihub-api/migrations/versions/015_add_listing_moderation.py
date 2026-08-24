"""add listing moderation status + moderation_events

Adds `moderation_status` to both listing tables (`supply_listings`,
`harvest_listings`) and a `moderation_events` audit table.

WHY EXISTING ROWS ARE BACKFILLED TO 'clean' (this is load-bearing, not sloppy):
The column default is 'pending_scan', which is correct for NEW and EDITED
listings — they queue for an AI scan and get flagged only if the scan says so.
But every row that already exists was published by a real farmer or supplier
before moderation existed. Prod carries 7 supply + 21 harvest live listings,
and a national TV interview airs next week. Sweeping those through a fresh
scanner means a single false positive auto-unpublishes a genuine farmer's
listing in front of a national audience. Not scanning pre-existing content is
strictly the smaller risk, so the UPDATE below marks all existing rows 'clean'
and only new/edited listings ever enter 'pending_scan'.

`moderation_events.listing_id` deliberately carries NO foreign key: one table
records events for two different listing tables, discriminated by
`listing_type`. The (listing_type, listing_id) index carries the lookups.

Revision ID: 015
Revises: 014
Create Date: 2026-08-23
"""

import sqlalchemy as sa
from alembic import op

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("supply_listings", "harvest_listings"):
        op.add_column(
            table,
            sa.Column(
                "moderation_status",
                sa.String(20),
                nullable=False,
                server_default="pending_scan",
            ),
        )
        # Backfill: pre-existing listings are trusted, never auto-scanned.
        # See the module docstring — this is the whole point of the migration.
        op.execute(f"UPDATE {table} SET moderation_status = 'clean'")
        op.create_index(
            f"ix_{table}_moderation_status",
            table,
            ["moderation_status"],
        )

    op.create_table(
        "moderation_events",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("listing_type", sa.String(20), nullable=False),
        # No FK: points at supply_listings OR harvest_listings.
        sa.Column("listing_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("verdict", sa.String(20), nullable=False),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        # `updated_at` is not part of the event contract (events are immutable),
        # but every model in this codebase inherits app.database.Base, which
        # declares it. Omitting the column here would break every ORM insert.
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_moderation_events_listing",
        "moderation_events",
        ["listing_type", "listing_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_moderation_events_listing", table_name="moderation_events")
    op.drop_table("moderation_events")
    for table in ("supply_listings", "harvest_listings"):
        op.drop_index(f"ix_{table}_moderation_status", table_name=table)
        op.drop_column(table, "moderation_status")
