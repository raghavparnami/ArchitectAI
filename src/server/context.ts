import 'server-only';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

// Demo build — no auth. Every request resolves to a stable demo user so
// `protectedProcedure` keeps working without Clerk.
const DEMO_USER_ID = 'demo-user';
const DEMO_WORKSPACE_ID = 'personal:demo-user';

export async function createContext() {
  await ensureDemoUserRow();
  return {
    userId: DEMO_USER_ID,
    orgId: null,
    workspaceId: DEMO_WORKSPACE_ID,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

async function ensureDemoUserRow(): Promise<void> {
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, DEMO_USER_ID))
    .limit(1);
  if (existing.length > 0) return;
  await db
    .insert(schema.users)
    .values({
      id: DEMO_USER_ID,
      email: 'demo@architectai.local',
      displayName: 'Demo User',
    })
    .onConflictDoNothing();
}
