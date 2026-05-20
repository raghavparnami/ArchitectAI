import { z } from 'zod';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { db, schema } from '@/lib/db';
import { protectedProcedure, router } from '../trpc';
import { runCodeScan } from '@/lib/codescan/runScan';

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

const fileInput = z.object({
  label: z.string().min(1).max(200),
  sql: z.string().min(1).max(200_000),
});

export const codescanRouter = router({
  // ── Scans ─────────────────────────────────────────────────────────────
  listScans: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.workspaceId, input.projectId);
      return db
        .select()
        .from(schema.scans)
        .where(
          and(
            eq(schema.scans.projectId, input.projectId),
            eq(schema.scans.kind, 'codescan')
          )
        )
        .orderBy(desc(schema.scans.startedAt))
        .limit(50);
    }),

  // ── Findings ──────────────────────────────────────────────────────────
  listFindings: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        pillar: z.enum(['codescan', 'architect', 'integration']).optional(),
        scanId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.workspaceId, input.projectId);
      const filters = [eq(schema.findings.projectId, input.projectId)];
      if (input.pillar) filters.push(eq(schema.findings.pillar, input.pillar));
      if (input.scanId) filters.push(eq(schema.findings.scanId, input.scanId));
      return db
        .select()
        .from(schema.findings)
        .where(and(...filters))
        .orderBy(desc(schema.findings.score), desc(schema.findings.updatedAt))
        .limit(200);
    }),

  findingById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(schema.findings)
        .where(eq(schema.findings.id, input.id))
        .limit(1);
      const row = rows[0];
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertProjectAccess(ctx.workspaceId, row.projectId);
      return row;
    }),

  setStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum([
          'open',
          'acknowledged',
          'fixed',
          'wont_fix',
          'duplicate',
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .select({
          id: schema.findings.id,
          projectId: schema.findings.projectId,
        })
        .from(schema.findings)
        .where(eq(schema.findings.id, input.id))
        .limit(1);
      const row = rows[0];
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertProjectAccess(ctx.workspaceId, row.projectId);
      await db
        .update(schema.findings)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(schema.findings.id, input.id));
      return { ok: true as const };
    }),

  // ── Run a scan synchronously over pasted/uploaded SQL files ───────────
  runSqlScan: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        label: z.string().max(200).optional(),
        files: z.array(fileInput).min(1).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.workspaceId, input.projectId);
      return runCodeScan({
        projectId: input.projectId,
        triggeredByUserId: ctx.userId,
        label: input.label,
        files: input.files,
      });
    }),
});

// re-export to satisfy bundler import-tracing in some setups
export { inArray };
