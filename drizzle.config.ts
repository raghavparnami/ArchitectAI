import type { Config } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  // Drizzle Kit reads this at CLI time, so a missing URL should fail loud.
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example → .env.local and fill in your Supabase Postgres connection string.'
  );
}

export default {
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  // Skip rows the user is not allowed to read; useful when the DB grew
  // before drizzle was introduced.
  strict: true,
  verbose: true,
} satisfies Config;
