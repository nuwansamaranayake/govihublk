"""Enforce phone number requirement via CHECK constraints.

Step 1 migration of the phone-mandatory rollout. This runs AFTER:
  - the app-layer gate has been live for at least 48 hours, and
  - `SELECT COUNT(*) FROM users WHERE role != 'admin' AND (phone IS NULL OR phone = '')`
    returns 0.

Running this migration before those conditions are met will lock out existing
users at their next login with a 500 instead of a clean 428 redirect. Do NOT
downgrade this revision in production without first dropping the app-layer
validator; otherwise the CHECK will reject legitimate non-E.164 writes.

Revision ID: 011
Revises: 010
"""

from alembic import op


revision = "011"
down_revision = "010"


def upgrade() -> None:
    # Normalise blank strings to NULL so the existence check is unambiguous.
    op.execute(
        """
        UPDATE users
        SET phone = NULL
        WHERE phone = '' OR phone IS NULL
        """
    )

    # Non-admin users must have a phone; admins may remain NULL.
    op.create_check_constraint(
        "ck_users_phone_required_for_non_admin",
        "users",
        "(role = 'admin') OR (phone IS NOT NULL AND phone <> '')",
    )

    # Any non-NULL phone must be in strict E.164 format.
    op.create_check_constraint(
        "ck_users_phone_e164",
        "users",
        r"phone IS NULL OR phone ~ '^\+[1-9][0-9]{1,14}$'",
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_phone_e164", "users", type_="check")
    op.drop_constraint("ck_users_phone_required_for_non_admin", "users", type_="check")
