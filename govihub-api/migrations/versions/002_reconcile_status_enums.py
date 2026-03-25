"""reconcile_status_enums

Revision ID: 002
Revises: 001
Create Date: 2026-03-23

Renames and reconciles status enum values to match the architecture spec:

Harvest Listings:
  draft    → planned
  active   → ready
  sold     → fulfilled
  (matched, expired, cancelled unchanged)
  Enum type renamed: listing_status → harvest_status

Demand Postings:
  draft    → open
  active   → open
  matched  → reviewing
  (fulfilled, expired, cancelled unchanged)
  NEW values added: confirmed, closed
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ---------------------------------------------------------------------------
# Upgrade
# ---------------------------------------------------------------------------

def upgrade() -> None:
    conn = op.get_bind()

    # -----------------------------------------------------------------------
    # 1. Harvest Listings — migrate data first, then swap the ENUM type
    # -----------------------------------------------------------------------

    # Drop old CHECK constraint (may not exist if migration 001 was clean)
    conn.execute(sa.text(
        "ALTER TABLE harvest_listings DROP CONSTRAINT IF EXISTS harvest_listing_status_check"
    ))
    conn.execute(sa.text(
        "ALTER TABLE harvest_listings DROP CONSTRAINT IF EXISTS ck_harvest_listings_harvest_listing_status_check"
    ))

    # Cast column to plain text so we can migrate values without the old enum
    op.execute(
        "ALTER TABLE harvest_listings ALTER COLUMN status TYPE TEXT USING status::TEXT"
    )

    # Rename old enum values
    op.execute("UPDATE harvest_listings SET status = 'planned'  WHERE status = 'draft'")
    op.execute("UPDATE harvest_listings SET status = 'ready'    WHERE status = 'active'")
    op.execute("UPDATE harvest_listings SET status = 'fulfilled' WHERE status = 'sold'")

    # Drop default that references the old enum
    op.execute("ALTER TABLE harvest_listings ALTER COLUMN status DROP DEFAULT")
    # Drop old listing_status ENUM type
    conn.execute(sa.text("DROP TYPE IF EXISTS listing_status"))

    # Create new harvest_status ENUM type
    harvest_status = postgresql.ENUM(
        "planned", "ready", "matched", "fulfilled", "expired", "cancelled",
        name="harvest_status",
        create_type=True,
    )
    harvest_status.create(conn, checkfirst=True)

    # Cast column back to the new enum type
    op.execute(
        "ALTER TABLE harvest_listings "
        "ALTER COLUMN status TYPE harvest_status USING status::harvest_status"
    )

    # Set new default
    op.execute(
        "ALTER TABLE harvest_listings ALTER COLUMN status SET DEFAULT 'planned'::harvest_status"
    )

    # Add new CHECK constraint
    op.create_check_constraint(
        "harvest_listing_status_check",
        "harvest_listings",
        "status IN ('planned', 'ready', 'matched', 'fulfilled', 'expired', 'cancelled')",
    )

    # -----------------------------------------------------------------------
    # 2. Demand Postings — migrate data, then extend the ENUM type
    # -----------------------------------------------------------------------

    # Drop old CHECK constraint (may not exist if migration 001 was clean)
    conn.execute(sa.text(
        "ALTER TABLE demand_postings DROP CONSTRAINT IF EXISTS demand_posting_status_check"
    ))
    conn.execute(sa.text(
        "ALTER TABLE demand_postings DROP CONSTRAINT IF EXISTS ck_demand_postings_demand_posting_status_check"
    ))

    # Cast column to plain text
    op.execute(
        "ALTER TABLE demand_postings ALTER COLUMN status TYPE TEXT USING status::TEXT"
    )

    # Rename old enum values
    op.execute("UPDATE demand_postings SET status = 'open'      WHERE status = 'draft'")
    op.execute("UPDATE demand_postings SET status = 'open'      WHERE status = 'active'")
    op.execute("UPDATE demand_postings SET status = 'reviewing' WHERE status = 'matched'")

    # Drop default that references the old enum
    op.execute("ALTER TABLE demand_postings ALTER COLUMN status DROP DEFAULT")
    # Drop old demand_status ENUM type
    conn.execute(sa.text("DROP TYPE IF EXISTS demand_status"))

    # Create new demand_status ENUM type with additional values
    demand_status = postgresql.ENUM(
        "open", "reviewing", "confirmed", "fulfilled", "closed", "expired", "cancelled",
        name="demand_status",
        create_type=True,
    )
    demand_status.create(conn, checkfirst=True)

    # Cast column back to the new enum type
    op.execute(
        "ALTER TABLE demand_postings "
        "ALTER COLUMN status TYPE demand_status USING status::demand_status"
    )

    # Set new default
    op.execute(
        "ALTER TABLE demand_postings ALTER COLUMN status SET DEFAULT 'open'::demand_status"
    )

    # Add new CHECK constraint
    op.create_check_constraint(
        "demand_posting_status_check",
        "demand_postings",
        "status IN ('open', 'reviewing', 'confirmed', 'fulfilled', 'closed', 'expired', 'cancelled')",
    )


# ---------------------------------------------------------------------------
# Downgrade
# ---------------------------------------------------------------------------

def downgrade() -> None:
    conn = op.get_bind()

    # -----------------------------------------------------------------------
    # 2. Revert Demand Postings
    # -----------------------------------------------------------------------

    op.drop_constraint("demand_posting_status_check", "demand_postings", type_="check")

    op.execute(
        "ALTER TABLE demand_postings ALTER COLUMN status TYPE TEXT USING status::TEXT"
    )

    # Revert values (best-effort; confirmed/closed have no old equivalent → open)
    op.execute("UPDATE demand_postings SET status = 'draft'   WHERE status = 'open'")
    op.execute("UPDATE demand_postings SET status = 'matched' WHERE status = 'reviewing'")
    op.execute("UPDATE demand_postings SET status = 'matched' WHERE status = 'confirmed'")
    op.execute("UPDATE demand_postings SET status = 'active'  WHERE status = 'closed'")

    conn.execute(sa.text("DROP TYPE IF EXISTS demand_status"))

    old_demand_status = postgresql.ENUM(
        "draft", "active", "matched", "fulfilled", "expired", "cancelled",
        name="demand_status",
        create_type=True,
    )
    old_demand_status.create(conn, checkfirst=True)

    op.execute(
        "ALTER TABLE demand_postings "
        "ALTER COLUMN status TYPE demand_status USING status::demand_status"
    )
    op.execute(
        "ALTER TABLE demand_postings ALTER COLUMN status SET DEFAULT 'draft'::demand_status"
    )

    op.create_check_constraint(
        "demand_posting_status_check",
        "demand_postings",
        "status IN ('draft', 'active', 'matched', 'fulfilled', 'expired', 'cancelled')",
    )

    # -----------------------------------------------------------------------
    # 1. Revert Harvest Listings
    # -----------------------------------------------------------------------

    op.drop_constraint("harvest_listing_status_check", "harvest_listings", type_="check")

    op.execute(
        "ALTER TABLE harvest_listings ALTER COLUMN status TYPE TEXT USING status::TEXT"
    )

    # Revert values
    op.execute("UPDATE harvest_listings SET status = 'draft'  WHERE status = 'planned'")
    op.execute("UPDATE harvest_listings SET status = 'active' WHERE status = 'ready'")
    op.execute("UPDATE harvest_listings SET status = 'sold'   WHERE status = 'fulfilled'")

    conn.execute(sa.text("DROP TYPE IF EXISTS harvest_status"))

    old_listing_status = postgresql.ENUM(
        "draft", "active", "matched", "sold", "expired", "cancelled",
        name="listing_status",
        create_type=True,
    )
    old_listing_status.create(conn, checkfirst=True)

    op.execute(
        "ALTER TABLE harvest_listings "
        "ALTER COLUMN status TYPE listing_status USING status::listing_status"
    )
    op.execute(
        "ALTER TABLE harvest_listings ALTER COLUMN status SET DEFAULT 'draft'::listing_status"
    )

    op.create_check_constraint(
        "harvest_listing_status_check",
        "harvest_listings",
        "status IN ('draft', 'active', 'matched', 'sold', 'expired', 'cancelled')",
    )
