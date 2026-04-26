import { generateObject } from 'ai';
import { eq, and, max } from 'drizzle-orm';
import { inngest } from '../client';
import { db, schema } from '@/lib/db';
import { resolveModel } from '@/lib/llm/client';
import {
  HLD_SYSTEM_PROMPT,
  buildHldUserPrompt,
  hldGenerationSchema,
} from '@/lib/llm/prompts/hld';
import { searchForCitations } from '@/lib/research/tavily';
import {
  architectureSchema,
  type Architecture,
} from '@/lib/architecture/schema';
import { assertInvariants } from '@/lib/architecture/invariants';

const newId = () =>
  `arch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const generateHldFn = inngest.createFunction(
  {
    id: 'architecture-generate-hld',
    retries: 2,
    concurrency: { limit: 5 },
    onFailure: async ({ event, error }) => {
      // The original event is wrapped under data.event in onFailure.
      const original = (event.data as { event?: { data?: { projectId?: string; requestedBy?: string } } }).event;
      const projectId = original?.data?.projectId ?? 'unknown';
      const requestedBy = original?.data?.requestedBy ?? 'unknown';
      await inngest.send({
        name: 'architecture/generation.failed',
        data: {
          projectId,
          reason: error.message,
          requestedBy,
        },
      });
    },
  },
  { event: 'architecture/generate.requested' },
  async ({ event, step }) => {
    const {
      projectId,
      level,
      problemStatement,
      techHints,
      parentArchitectureId,
      requestedBy,
      provider,
      modelId,
    } = event.data;

    if (level !== 'HLD') {
      // LLD generation lives in a separate function (M3) — this one is
      // HLD-only to keep concurrency budgets simple.
      return { skipped: true, reason: 'level != HLD' };
    }

    // ─── Step 1: Web research for cited decisions ────────────────────────
    // Inngest `step.run` makes each unit independently retryable.
    const citations = await step.run('research', async () => {
      try {
        return await searchForCitations(problemStatement);
      } catch (err) {
        // Research is nice-to-have. If Tavily is down or unconfigured,
        // proceed without citations — the LLM falls back to first
        // principles per the prompt.
        console.warn('[inngest:generateHld] research failed:', err);
        return [];
      }
    });

    // ─── Step 2: LLM generation ──────────────────────────────────────────
    const generation = await step.run('llm-generate', async () => {
      const { model } = await resolveModel({
        userId: requestedBy,
        provider,
        modelId,
      });

      const { object } = await generateObject({
        model,
        schema: hldGenerationSchema,
        system: HLD_SYSTEM_PROMPT,
        prompt: buildHldUserPrompt({
          problemStatement,
          techHints,
          citations,
        }),
        temperature: 0.4,
      });

      return object;
    });

    // ─── Step 3: Build canonical, validate, persist ──────────────────────
    return await step.run('persist', async () => {
      const [{ value: maxVersion } = { value: 0 }] = await db
        .select({ value: max(schema.architectures.version) })
        .from(schema.architectures)
        .where(
          and(
            eq(schema.architectures.projectId, projectId),
            eq(schema.architectures.level, 'HLD')
          )
        );
      const version = (maxVersion ?? 0) + 1;
      const id = newId();

      const canonical: Architecture = architectureSchema.parse({
        id,
        projectId,
        level: 'HLD',
        parentArchitectureId,
        version,
        state: 'Draft',
        title: generation.title,
        problemStatement,
        nfrs: generation.nfrs,
        components: generation.components.map((c) => ({
          ...c,
          apis: [],
          responsibilities: c.responsibilities,
          nfrIds: c.nfrIds,
        })),
        connections: generation.connections,
        dataStores: [],
        externalSystems: generation.externalSystems,
        useCases: [],
        sequences: [],
        decisions: generation.decisions.map((d) => ({
          ...d,
          status: 'Proposed' as const,
        })),
        citations,
        manualEdits: [],
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: requestedBy,
          llmModel: modelId,
        },
      });

      assertInvariants(canonical);

      const [row] = await db
        .insert(schema.architectures)
        .values({
          id,
          projectId,
          level: 'HLD',
          parentArchitectureId,
          version,
          state: 'Draft',
          title: canonical.title,
          canonical,
          llmModel: modelId,
          createdBy: requestedBy,
        })
        .returning();

      // Persist denormalized decisions for queryability.
      if (canonical.decisions.length > 0) {
        await db.insert(schema.decisions).values(
          canonical.decisions.map((d, i) => ({
            id: d.id,
            architectureId: row.id,
            question: d.question,
            chosen: d.chosen,
            rationale: d.rationale,
            status: d.status,
            position: i,
          }))
        );
      }

      // Persist citations as plain rows. Embeddings are not stored in the
      // SQLite prototype; semantic recall over citations is a follow-up
      // (sqlite-vec on Turso, or migrate to Postgres + pgvector).
      if (citations.length > 0) {
        await db.insert(schema.citations).values(
          citations.map((c) => ({
            id: c.id,
            architectureId: row.id,
            url: c.url,
            title: c.title,
            snippet: c.snippet,
          }))
        );
      }

      await inngest.send({
        name: 'architecture/generated',
        data: { architectureId: row.id, version },
      });

      return { architectureId: row.id, version };
    });
  }
);
