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
import {
  architectureSchema,
  type Architecture,
} from '@/lib/architecture/schema';
import { mergeArchitectures } from '@/lib/architecture/merge';
import { assertInvariants } from '@/lib/architecture/invariants';

const newId = () =>
  `arch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Regeneration is the trickiest UX: the LLM rewrites the architecture,
 * but the user's pinned manual edits must survive. The merge logic
 * lives in lib/architecture/merge.ts; this function:
 *
 *   1. Loads the current canonical Architecture.
 *   2. Asks the LLM to produce a fresh version, given the user's
 *      instruction and the prior canonical as context.
 *   3. Three-way merges (base + pinned edits + new generation).
 *   4. Persists as v(N+1), Draft, with the same parentArchitectureId.
 */
export const regenerateWithEditsFn = inngest.createFunction(
  {
    id: 'architecture-regenerate-with-edits',
    retries: 2,
    concurrency: { limit: 5 },
  },
  { event: 'architecture/regenerate.requested' },
  async ({ event, step }) => {
    const { architectureId, instruction, requestedBy, provider, modelId } =
      event.data;

    const base = await step.run('load-base', async () => {
      const rows = await db
        .select()
        .from(schema.architectures)
        .where(eq(schema.architectures.id, architectureId))
        .limit(1);
      if (!rows[0]) throw new Error(`Architecture ${architectureId} not found`);
      return rows[0];
    });

    if (base.state === 'Approved') {
      throw new Error(
        'Cannot regenerate an Approved architecture. Fork to a new version first.'
      );
    }

    const baseCanonical = architectureSchema.parse(base.canonical);

    const generation = await step.run('llm-regenerate', async () => {
      const { model } = await resolveModel({
        userId: requestedBy,
        provider,
        modelId,
      });

      // The pinned edits are conveyed implicitly via the prior canonical
      // (which already has them applied). We additionally tell the
      // model to KEEP the pinned fields verbatim — important when the
      // instruction contradicts them.
      const pinnedSummary = baseCanonical.manualEdits
        .filter((e) => e.pinned)
        .map((e) => `- ${e.targetType}:${e.targetId}.${e.field} = ${JSON.stringify(e.value)}`)
        .join('\n');

      const userPrompt = [
        buildHldUserPrompt({
          problemStatement: baseCanonical.problemStatement,
          citations: baseCanonical.citations,
          priorArchitectureCanonical: baseCanonical,
        }),
        '',
        `USER INSTRUCTION FOR THIS REGENERATION:`,
        instruction,
        '',
        pinnedSummary
          ? `PINNED FIELDS — DO NOT CHANGE THESE VALUES, EVEN IF THE INSTRUCTION SUGGESTS OTHERWISE:\n${pinnedSummary}`
          : 'No pinned fields.',
      ].join('\n');

      const { object } = await generateObject({
        model,
        schema: hldGenerationSchema,
        system: HLD_SYSTEM_PROMPT,
        prompt: userPrompt,
        temperature: 0.3,
      });

      return object;
    });

    return await step.run('merge-and-persist', async () => {
      // Build a fresh canonical from the LLM output, then merge with the
      // base. Note that `next.id` doesn't matter — merge() copies the
      // base id forward; we'll overwrite with a new one before insert.
      const next: Architecture = architectureSchema.parse({
        id: 'unused',
        projectId: base.projectId,
        level: base.level,
        version: base.version, // overwritten below
        state: 'Draft',
        title: generation.title,
        problemStatement: baseCanonical.problemStatement,
        nfrs: generation.nfrs,
        components: generation.components.map((c) => ({
          ...c,
          apis: [],
          responsibilities: c.responsibilities,
          nfrIds: c.nfrIds,
        })),
        connections: generation.connections,
        dataStores: baseCanonical.dataStores,
        externalSystems: generation.externalSystems,
        useCases: baseCanonical.useCases,
        sequences: baseCanonical.sequences,
        decisions: generation.decisions.map((d) => ({
          ...d,
          status: 'Proposed' as const,
        })),
        citations: baseCanonical.citations, // research re-use; M2 may refresh
        manualEdits: [],
        metadata: {
          ...baseCanonical.metadata,
          createdAt: new Date().toISOString(),
          createdBy: requestedBy,
          llmModel: modelId,
        },
      });

      const { merged, diff, orphanIds } = mergeArchitectures(baseCanonical, next);

      const [{ value: maxVersion } = { value: 0 }] = await db
        .select({ value: max(schema.architectures.version) })
        .from(schema.architectures)
        .where(
          and(
            eq(schema.architectures.projectId, base.projectId),
            eq(schema.architectures.level, base.level)
          )
        );
      const version = (maxVersion ?? 0) + 1;
      const id = newId();

      const finalCanonical: Architecture = {
        ...merged,
        id,
        version,
      };

      assertInvariants(finalCanonical);

      const [row] = await db
        .insert(schema.architectures)
        .values({
          id,
          projectId: base.projectId,
          level: base.level,
          parentArchitectureId: base.id, // lineage points at predecessor
          version,
          state: 'Draft',
          title: finalCanonical.title,
          canonical: finalCanonical,
          llmModel: modelId,
          createdBy: requestedBy,
        })
        .returning();

      await inngest.send({
        name: 'architecture/generated',
        data: { architectureId: row.id, version },
      });

      return {
        architectureId: row.id,
        version,
        diff,
        orphanCount: orphanIds.length,
      };
    });
  }
);
