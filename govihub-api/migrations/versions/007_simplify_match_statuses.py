"""Simplify match statuses from 9 to 4.

Old: proposed, accepted_farmer, accepted_buyer, confirmed, in_transit,
     fulfilled, disputed, cancelled, expired
New: proposed, accepted, completed, dismissed

Data migration:
  accepted_farmer / accepted_buyer → accepted
  confirmed / in_transit           → accepted
  fulfilled                        → completed
  disputed / cancelled / expired   → dismissed

Revision ID: 007
Revises: 006
"""

from alembic import op

revision = "007"
down_revision = "006"


def upgrade() -> None:
    # 1. Drop the check constraint that references old values
    op.execute("ALTER TABLE matches DROP CONSTRAINT IF EXISTS match_status_check")

    # 2. Convert column to TEXT so we can freely update values
    op.execute("ALTER TABLE matches ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TABLE matches ALTER COLUMN status TYPE TEXT USING status::TEXT")

    # 3. Migrate existing data to new status values
    op.execute("UPDATE matches SET status = 'accepted' WHERE status IN ('accepted_farmer', 'accepted_buyer', 'confirmed', 'in_transit')")
    op.execute("UPDATE matches SET status = 'completed' WHERE status = 'fulfilled'")
    op.execute("UPDATE matches SET status = 'dismissed' WHERE status IN ('disputed', 'cancelled', 'expired')")

    # 4. Drop the old enum type and create the new one
    op.execute("DROP TYPE IF EXISTS match_status")
    op.execute("CREATE TYPE match_status AS ENUM ('proposed', 'accepted', 'completed', 'dismissed')")

    # 5. Convert column back to the new enum type
    op.execute("ALTER TABLE matches ALTER COLUMN status TYPE match_status USING status::match_status")
    op.execute("ALTER TABLE matches ALTER COLUMN status SET DEFAULT 'proposed'::match_status")

    # 6. Re-create the check constraint with new values
    op.execute(
        "ALTER TABLE matches ADD CONSTRAINT match_status_check "
        "CHECK (status IN ('proposed', 'accepted', 'completed', 'dismissed'))"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE matches DROP CONSTRAINT IF EXISTS match_status_check")
    op.execute("ALTER TABLE matches ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TABLE matches ALTER COLUMN status TYPE TEXT USING status::TEXT")

    # Map new → old
    op.execute("UPDATE matches SET status = 'confirmed' WHERE status = 'accepted'")
    op.execute("UPDATE matches SET status = 'fulfilled' WHERE status = 'completed'")
    op.execute("UPDATE matches SET status = 'cancelled' WHERE status = 'dismissed'")

    op.execute("DROP TYPE IF EXISTS match_status")
    op.execute(
        "CREATE TYPE match_status AS ENUM ("
        "'proposed', 'accepted_farmer', 'accepted_buyer', 'confirmed', "
        "'in_transit', 'fulfilled', 'disputed', 'cancelled', 'expired')"
    )

    op.execute("ALTER TABLE matches ALTER COLUMN status TYPE match_status USING status::match_status")
    op.execute("ALTER TABLE matches ALTER COLUMN status SET DEFAULT 'proposed'::match_status")

    op.execute(
        "ALTER TABLE matches ADD CONSTRAINT match_status_check "
        "CHECK (status IN ('proposed', 'accepted_farmer', 'accepted_buyer', 'confirmed', "
        "'in_transit', 'fulfilled', 'disputed', 'cancelled', 'expired'))"
    )
