import 'server-only';
import { auth, currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

/**
 * tRPC request context. The proxy file enforces auth on every non-public
 * route, so by the time a tRPC procedure runs the user is authenticated
 * — but we still re-check here as defense in depth (Server Actions can
 * bypass proxy in edge cases per Next.js 16 docs).
 */
export async function createContext() {
  const session = await auth();
  if (!session.userId) {
    return { userId: null, orgId: null, workspaceId: null };
  }

  // Lazily ensure a `users` row exists for the Clerk user. Cheaper than
  // running a webhook listener in M0.
  await ensureUserRow(session.userId);

  return {
    userId: session.userId,
    orgId: session.orgId ?? null,
    // For Phase 1 we treat the active Clerk org as the workspace. Users
    // not in any org get a personal workspace bootstrapped on first
    // login by `ensureWorkspaceForUser`.
    workspaceId: session.orgId ?? `personal:${session.userId}`,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

async function ensureUserRow(userId: string): Promise<void> {
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (existing.length > 0) return;

  const u = await currentUser();
  await db
    .insert(schema.users)
    .values({
      id: userId,
      email: u?.primaryEmailAddress?.emailAddress ?? `${userId}@unknown.local`,
      displayName: u?.fullName ?? null,
    })
    .onConflictDoNothing();
}
