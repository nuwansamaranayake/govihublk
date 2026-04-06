#!/usr/bin/env python3
"""
Seed GoviHub knowledge_chunks table with spice crop content.
Embeds text using paraphrase-multilingual-MiniLM-L12-v2 (384 dims)
and inserts into PostgreSQL with pgvector.
"""
import json
import sys
import os
import uuid
import asyncio
import logging
from datetime import datetime

import asyncpg
from sentence_transformers import SentenceTransformer

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
log = logging.getLogger(__name__)

# Config — strip SQLAlchemy driver prefix if present (postgresql+asyncpg:// → postgresql://)
_raw_db_url = os.getenv("DATABASE_URL", "postgresql://govihub:govihub@localhost:5432/govihub")
DB_URL = _raw_db_url.replace("postgresql+asyncpg://", "postgresql://").replace("postgres+asyncpg://", "postgresql://")
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
BATCH_SIZE = 50  # embed this many at once

async def main(json_path: str, dry_run: bool = False):
    # Load chunks
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    chunks = data['chunks']
    log.info(f"Loaded {len(chunks)} chunks from {json_path}")

    # Load embedding model
    log.info(f"Loading model: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)

    # Verify dimensionality
    test_emb = model.encode(["test"])
    assert test_emb.shape[1] == 384, f"Expected 384 dims, got {test_emb.shape[1]}"
    log.info("Model loaded, 384-dim embeddings confirmed")

    # Connect to DB
    conn = await asyncpg.connect(DB_URL)

    # Check current count
    current = await conn.fetchval("SELECT COUNT(*) FROM knowledge_chunks")
    log.info(f"Current knowledge_chunks count: {current}")

    if dry_run:
        log.info("DRY RUN — embedding first 5 chunks only, no DB insert")
        chunks = chunks[:5]

    # Process in batches
    inserted = 0
    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        texts = [c['content'] for c in batch]

        # Embed
        embeddings = model.encode(texts, show_progress_bar=False)

        # Insert
        for j, chunk in enumerate(batch):
            emb = embeddings[j].tolist()
            emb_str = "[" + ",".join(str(x) for x in emb) + "]"

            if not dry_run:
                await conn.execute("""
                    INSERT INTO knowledge_chunks (id, source, content, embedding, metadata, language, created_at)
                    VALUES ($1, $2, $3, $4::vector, $5::jsonb, $6, $7)
                """,
                    uuid.uuid4(),
                    chunk['source'],
                    chunk['content'],
                    emb_str,
                    json.dumps(chunk['metadata']),
                    chunk['language'],
                    datetime.utcnow()
                )
            inserted += 1

        log.info(f"  Batch {i//BATCH_SIZE + 1}: embedded+inserted {len(batch)} chunks ({inserted}/{len(chunks)} total)")

    # Verify
    if not dry_run:
        new_count = await conn.fetchval("SELECT COUNT(*) FROM knowledge_chunks")
        log.info(f"Done! knowledge_chunks: {current} -> {new_count} (+{new_count - current})")

        # Show breakdown by crop
        rows = await conn.fetch("""
            SELECT metadata->>'crop_type' as crop, COUNT(*) as cnt
            FROM knowledge_chunks
            GROUP BY metadata->>'crop_type'
            ORDER BY cnt DESC
        """)
        for row in rows:
            log.info(f"  {row['crop']:20s} {row['cnt']:4d} chunks")
    else:
        log.info(f"DRY RUN complete — {inserted} chunks would be inserted")

    await conn.close()

if __name__ == "__main__":
    json_path = sys.argv[1] if len(sys.argv) > 1 else "chunks_for_ingestion.json"
    dry_run = "--dry-run" in sys.argv
    asyncio.run(main(json_path, dry_run))
