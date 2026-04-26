import { z } from 'zod';
import { and, asc, desc, eq, max } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { db, schema } from '@/lib/db';
import { protectedProcedure, router } from '../trpc';
import { architectureSchema } from '@/lib/architecture/schema';
import { assertInvariants } from '@/lib/architecture/invariants';
import { inngest } from '@/lib/inngest/client';

const newId = () =>
  `arch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

async function assertProjectAccess(workspaceId: string, projectId: string) {
  const rows = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.workspaceId, workspaceId)
      )
    )
    .limit(1);
  if (rows.length === 0) throw new TRPCError({ code: 'NOT_FOUND' });
}

export const architecturesRouter = router({
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.workspaceId, input.projectId);
      return db
        .select()
        .from(schema.architectures)
        .where(eq(schema.architectures.projectId, input.projectId))
        .orderBy(
          asc(schema.architectures.level),
          desc(schema.architectures.version)
        );
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(schema.architectures)
        .where(eq(schema.architectures.id, input.id))
        .limit(1);
      const row = rows[0];
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertProjectAccess(ctx.workspaceId, row.projectId);
      return row;
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        canonical: architectureSchema, // full canonical, validated by zod
        parentArchitectureId: z.string().optional(),
        llmModel: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.workspaceId, input.projectId);
      assertInvariants(input.canonical);

      // Compute the next version number within (projectId, level).
      const [{ value: maxVersion } = { value: 0 }] = await db
        .select({ value: max(schema.architectures.version) })
        .from(schema.architectures)
        .where(
          and(
            eq(schema.architectures.projectId, input.projectId),
            eq(schema.architectures.level, input.canonical.level)
          )
        );
      const nextVersion = (maxVersion ?? 0) + 1;

      const id = newId();
      const [row] = await db
        .insert(schema.architectures)
        .values({
          id,
          projectId: input.projectId,
          level: input.canonical.level,
          parentArchitectureId: input.parentArchitectureId,
          version: nextVersion,
          state: 'Draft',
          title: input.canonical.title,
          canonical: { ...input.canonical, id, version: nextVersion },
          llmModel: input.llmModel,
          createdBy: ctx.userId,
        })
        .returning();
      return row;
    }),

  updateCanonical: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        canonical: architectureSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(schema.architectures)
        .where(eq(schema.architectures.id, input.id))
        .limit(1);
      const existing = rows[0];
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertProjectAccess(ctx.workspaceId, existing.projectId);
      if (existing.state === 'Approved') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message:
            'Architecture is approved and immutable. Fork it (create new version) to change.',
        });
      }
      assertInvariants(input.canonical);

      const [updated] = await db
        .update(schema.architectures)
        .set({
          canonical: input.canonical,
          title: input.canonical.title,
        })
        .where(eq(schema.architectures.id, input.id))
        .returning();
      return updated;
    }),

  /**
   * Kick off an HLD generation job. Returns immediately with the
   * Inngest event id; the client subscribes to `architecture/generated`
   * (or polls listByProject) to surface the new architecture.
   */
  generateHld: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        problemStatement: z.string().min(20).max(4000),
        techHints: z.array(z.string()).optional(),
        provider: z
          .enum(['anthropic', 'openai', 'google', 'custom'])
          .default('anthropic'),
        modelId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.workspaceId, input.projectId);
      const { ids } = await inngest.send({
        name: 'architecture/generate.requested',
        data: {
          projectId: input.projectId,
          level: 'HLD',
          problemStatement: input.problemStatement,
          techHints: input.techHints,
          requestedBy: ctx.userId,
          provider: input.provider,
          modelId: input.modelId,
        },
      });
      return { eventId: ids[0] };
    }),

  /**
   * Regenerate an existing architecture with a user-provided
   * instruction, preserving pinned manual edits.
   */
  regenerate: protectedProcedure
    .input(
      z.object({
        architectureId: z.string(),
        instruction: z.string().min(3).max(2000),
        provider: z
          .enum(['anthropic', 'openai', 'google', 'custom'])
          .default('anthropic'),
        modelId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(schema.architectures)
        .where(eq(schema.architectures.id, input.architectureId))
        .limit(1);
      if (!rows[0]) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertProjectAccess(ctx.workspaceId, rows[0].projectId);

      const { ids } = await inngest.send({
        name: 'architecture/regenerate.requested',
        data: {
          architectureId: input.architectureId,
          instruction: input.instruction,
          requestedBy: ctx.userId,
          provider: input.provider,
          modelId: input.modelId,
        },
      });
      return { eventId: ids[0] };
    }),

  setState: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        state: z.enum(['Draft', 'InReview', 'Approved', 'Superseded']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(schema.architectures)
        .where(eq(schema.architectures.id, input.id))
        .limit(1);
      const existing = rows[0];
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertProjectAccess(ctx.workspaceId, existing.projectId);

      // State machine: enforce legal transitions.
      const transitions: Record<string, string[]> = {
        Draft: ['InReview', 'Superseded'],
        InReview: ['Approved', 'Draft', 'Superseded'],
        Approved: ['Superseded'],
        Superseded: [],
      };
      const legal = transitions[existing.state] ?? [];
      if (!legal.includes(input.state)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot transition from ${existing.state} to ${input.state}`,
        });
      }

      const patch: Partial<typeof schema.architectures.$inferInsert> = {
        state: input.state,
      };
      if (input.state === 'Approved') {
        patch.approvedAt = new Date();
        patch.approvedBy = ctx.userId;
      }

      const [updated] = await db
        .update(schema.architectures)
        .set(patch)
        .where(eq(schema.architectures.id, input.id))
        .returning();
      return updated;
    }),
});
