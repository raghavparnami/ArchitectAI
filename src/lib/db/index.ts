import 'server-only';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. See .env.example.');
}

// Resolve relative paths from the project root so `npm run db:studio` and
// `next dev` agree on which file they're talking to even when the cwd
// differs.
const dbPath = databaseUrl.startsWith('/')
  ? databaseUrl
  : path.resolve(process.cwd(), databaseUrl);

declare global {
  var __sqlite_client__: Database.Database | undefined;
}

const client =
  globalThis.__sqlite_client__ ??
  (() => {
    const db = new Database(dbPath);
    // WAL mode = better concurrent read/write semantics for dev. Foreign
    // keys aren't enforced by default in SQLite — turn them on so our
    // ON DELETE CASCADE rules actually fire.
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    return db;
  })();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__sqlite_client__ = client;
}

export const db = drizzle(client, { schema });
export { schema };
export type Db = typeof db;
