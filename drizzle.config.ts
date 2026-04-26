import path from 'node:path';
import fs from 'node:fs';
import type { Config } from 'drizzle-kit';

// drizzle-kit runs outside of Next.js, so .env.local isn't auto-loaded.
// Parse it ourselves — keep it minimal, no external dotenv dep.
loadDotEnvLocal();

function loadDotEnvLocal() {
  const file = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["'](.*)["']$/, '$1');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example → .env.local and pick a SQLite file path (e.g. ./architectai.db).'
  );
}

const resolvedPath = databaseUrl.startsWith('/')
  ? databaseUrl
  : path.resolve(process.cwd(), databaseUrl);

export default {
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'sqlite',
  dbCredentials: { url: resolvedPath },
  strict: true,
  verbose: true,
} satisfies Config;
