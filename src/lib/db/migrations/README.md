# Migrations

We use Drizzle Kit to generate SQL migrations from `src/lib/db/schema.ts`
against a local SQLite database (path set by `DATABASE_URL`).

## Workflow

```bash
# After editing schema.ts:
npm run db:generate    # writes a new <hash>_<name>.sql here

# Apply pending migrations to the file at $DATABASE_URL:
npm run db:migrate

# Inspect the DB visually:
npm run db:studio

# Fast path for prototyping (no migration file): push schema directly.
# Drops + recreates tables, so don't run on data you care about.
npm run db:push
```

## SQLite specifics

- Foreign keys are OFF by default in SQLite. The runtime client at
  `src/lib/db/index.ts` enables them with `PRAGMA foreign_keys = ON`.
- WAL mode is enabled for better concurrent reads during dev.
- The DB file is created on first connect — no `CREATE EXTENSION` step
  is needed (unlike the Postgres branch we previously had).

## When the prototype outgrows SQLite

Citations carry no embeddings here — semantic recall over decisions
needs pgvector (Postgres) or sqlite-vec (libSQL/Turso). When that day
comes, swap `drizzle-orm/better-sqlite3` for `drizzle-orm/postgres-js`
in `db/index.ts`, run `db:generate` against the Postgres `DATABASE_URL`,
and re-add the hand-written `0000_extensions.sql` for pgvector.
