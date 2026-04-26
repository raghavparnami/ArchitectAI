-- Run BEFORE drizzle-generated migrations.
-- Drizzle Kit doesn't emit `CREATE EXTENSION` for pgvector; do it ourselves.
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
