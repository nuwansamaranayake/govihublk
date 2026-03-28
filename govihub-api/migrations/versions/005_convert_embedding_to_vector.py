"""Convert knowledge_chunks.embedding from bytea to vector(384).

The initial schema created the column as LargeBinary (bytea) because pgvector
was not installed at the time. This migration runs after the pgvector extension
is installed and converts the column to the correct vector(384) type.

Revision ID: 005
Revises: 004
"""

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    conn = op.get_bind()

    # Ensure pgvector extension exists
    conn.execute(sa.text('CREATE EXTENSION IF NOT EXISTS vector'))

    # Check current column type — skip if already vector to make idempotent
    result = conn.execute(sa.text(
        "SELECT udt_name FROM information_schema.columns "
        "WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding'"
    ))
    row = result.fetchone()
    if row and row[0] == 'vector':
        return  # already converted

    # All existing embeddings are NULL so no data conversion is needed
    op.execute('ALTER TABLE knowledge_chunks ALTER COLUMN embedding TYPE vector(384) USING NULL::vector(384)')

    # Create IVFFlat index for cosine similarity search
    op.execute(
        'CREATE INDEX IF NOT EXISTS ix_knowledge_chunks_embedding '
        'ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10)'
    )


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS ix_knowledge_chunks_embedding')
    op.execute('ALTER TABLE knowledge_chunks ALTER COLUMN embedding TYPE bytea USING NULL::bytea')
