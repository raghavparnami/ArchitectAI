import { z } from 'zod';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { db, schema } from '@/lib/db';
import { protectedProcedure, router } from '../trpc';

const newId = () =>
  `prj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.workspaceId, ctx.workspaceId),
          isNull(schema.projects.archivedAt)
        )
      )
      .orderBy(desc(schema.projects.createdAt));
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(schema.projects)
        .where(
          and(
            eq(schema.projects.id, input.id),
            eq(schema.projects.workspaceId, ctx.workspaceId)
          )
        )
        .limit(1);
      const row = rows[0];
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      return row;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        problemStatement: z.string().max(4000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Ensure the workspace row exists. Personal workspaces lazy-init
      // on first project creation; org workspaces are seeded the first
      // time we see a Clerk org id here.
      await db
        .insert(schema.workspaces)
        .values({
          id: ctx.workspaceId,
          clerkOrgId: ctx.orgId ?? `personal:${ctx.userId}`,
          name: ctx.orgId ? 'Workspace' : 'Personal',
        })
        .onConflictDoNothing();

      // Membership row so list queries scoped by workspace work.
      await db
        .insert(schema.workspaceMembers)
        .values({
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          role: 'owner',
        })
        .onConflictDoNothing();

      const id = newId();
      const [row] = await db
        .insert(schema.projects)
        .values({
          id,
          workspaceId: ctx.workspaceId,
          name: input.name,
          problemStatement: input.problemStatement,
          ownerId: ctx.userId,
        })
        .returning();
      return row;
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(schema.projects)
        .set({ archivedAt: new Date() })
        .where(
          and(
            eq(schema.projects.id, input.id),
            eq(schema.projects.workspaceId, ctx.workspaceId)
          )
        );
      return { ok: true as const };
    }),
});
