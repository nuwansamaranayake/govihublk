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
        WHERE phone = ''
        """
    )

    # Non-admin users must have a non-empty phone; admins may remain NULL or any format.
    # Fails loudly if any non-admin row has NULL phone at migration time (expected = 0).
    op.create_check_constraint(
        "ck_users_phone_required_for_non_admin",
        "users",
        "(role = 'admin') OR (phone IS NOT NULL AND phone <> '')",
    )

    # Non-admin phones must be strict E.164. Admins are fully exempt — their
    # phone column may be NULL or any legacy format. The non-empty requirement
    # for non-admins is already enforced by ck_users_phone_required_for_non_admin
    # above, so this constraint only needs to validate the format shape.
    op.create_check_constraint(
        "ck_users_phone_e164",
        "users",
        r"(role = 'admin') OR (phone IS NOT NULL AND phone ~ '^\+[1-9][0-9]{1,14}$')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_phone_e164", "users", type_="check")
    op.drop_constraint("ck_users_phone_required_for_non_admin", "users", type_="check")
