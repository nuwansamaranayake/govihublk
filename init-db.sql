-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- pgvector: optional — only available if installed in the image
-- The advisory/RAG module gracefully degrades without it
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "vector";
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not available — RAG features will use fallback';
END
$$;
