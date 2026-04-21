"""Allow same email/phone across different roles.

Drop unique constraints on email and phone individually.
Add composite unique constraints on (email, role) and (phone, role).
This lets the same person have one account per role (farmer, buyer, supplier).

Revision ID: 008
Revises: 007
"""

from alembic import op

revision = "008"
down_revision = "007"


def upgrade() -> None:
    # -- email: unique(email) → unique(email, role) --
    # Drop the individual unique constraint
    op.drop_constraint("uq_users_email", "users", type_="unique")
    # Drop the redundant individual index (we'll have a composite one)
    op.drop_index("ix_users_email", table_name="users")
    # Create composite unique constraint
    op.create_unique_constraint("uq_users_email_role", "users", ["email", "role"])
    # Create index on email for fast lookups
    op.create_index("ix_users_email", "users", ["email"])

    # -- phone: unique(phone) → unique(phone, role) --
    op.drop_constraint("uq_users_phone", "users", type_="unique")
    op.create_unique_constraint("uq_users_phone_role", "users", ["phone", "role"])


def downgrade() -> None:
    # Reverse: drop composites, restore individual uniques
    op.drop_constraint("uq_users_phone_role", "users", type_="unique")
    op.create_unique_constraint("uq_users_phone", "users", ["phone"])

    op.drop_index("ix_users_email", table_name="users")
    op.drop_constraint("uq_users_email_role", "users", type_="unique")
    op.create_unique_constraint("uq_users_email", "users", ["email"])
    op.create_index("ix_users_email", "users", ["email"])
