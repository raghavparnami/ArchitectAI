import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { db, schema } from '@/lib/db';
import { protectedProcedure, router } from '../trpc';
import { encryptApiKey, previewKey } from '@/lib/llm/keys';

const newId = () =>
  `key_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const llmKeysRouter = router({
  /**
   * List the user's keys WITHOUT decrypting. We only return metadata
   * + a redacted preview so the UI can show "anthropic — sk-…ABCD".
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        id: schema.userLlmKeys.id,
        provider: schema.userLlmKeys.provider,
        label: schema.userLlmKeys.label,
        baseUrl: schema.userLlmKeys.baseUrl,
        createdAt: schema.userLlmKeys.createdAt,
        lastUsedAt: schema.userLlmKeys.lastUsedAt,
      })
      .from(schema.userLlmKeys)
      .where(eq(schema.userLlmKeys.userId, ctx.userId));
    return rows;
  }),

  add: protectedProcedure
    .input(
      z.object({
        provider: z.enum(['anthropic', 'openai', 'google', 'custom']),
        label: z.string().min(1).max(60),
        apiKey: z.string().min(8).max(500),
        baseUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.provider === 'custom' && !input.baseUrl) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: "provider='custom' requires baseUrl",
        });
      }

      const blob = await encryptApiKey(input.apiKey);
      const id = newId();
      try {
        await db.insert(schema.userLlmKeys).values({
          id,
          userId: ctx.userId,
          provider: input.provider,
          label: input.label,
          encryptedKey: blob.ciphertext,
          nonce: blob.nonce,
          baseUrl: input.baseUrl,
        });
      } catch (e) {
        // Unique violation on (user, provider, label).
        throw new TRPCError({
          code: 'CONFLICT',
          message: `A key labeled "${input.label}" already exists for ${input.provider}`,
          cause: e,
        });
      }

      return {
        id,
        provider: input.provider,
        label: input.label,
        preview: previewKey(input.apiKey),
      };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await db
        .delete(schema.userLlmKeys)
        .where(
          and(
            eq(schema.userLlmKeys.id, input.id),
            eq(schema.userLlmKeys.userId, ctx.userId)
          )
        );
      // better-sqlite3 returns { changes, lastInsertRowid }
      return { ok: true as const, deleted: result.changes ?? 0 };
    }),
});
