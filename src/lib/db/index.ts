import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. See .env.example.');
}

// Reuse the connection across hot reloads in dev. Without this, every
// request opens a new pool and Postgres eventually rejects with too-many-
// connections.
declare global {
  var __pg_client__: ReturnType<typeof postgres> | undefined;
}

const client =
  globalThis.__pg_client__ ??
  postgres(databaseUrl, {
    // Supabase pooler closes idle TLS connections after ~10 minutes; we
    // keep the pool small in serverless environments.
    max: process.env.NODE_ENV === 'production' ? 1 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // pgbouncer in transaction mode does not support prepared statements
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__pg_client__ = client;
}

export const db = drizzle(client, { schema });
export { schema };
export type Db = typeof db;
