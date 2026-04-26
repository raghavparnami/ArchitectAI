import 'server-only';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { decryptApiKey } from './keys';
import {
  type ProviderId,
  type ResolvedKey,
  getModel,
  getServerDefaultKey,
} from './providers';
import type { LanguageModel } from 'ai';

export type ModelChoice = {
  /**
   * If set, use this user's BYO key (looked up by provider). If not
   * found OR `useServerDefault` is true, fall back to the server's env key.
   */
  userId?: string;
  provider: ProviderId;
  modelId?: string;
  /** When true, skip BYO and force the server default. */
  useServerDefault?: boolean;
};

export type ResolvedModel = {
  model: LanguageModel;
  source: 'byo' | 'server-default';
  keyLabel?: string; // for BYO, surfaced in audit logs
};

/**
 * Given a `userId` + provider, source the API key, build a Vercel AI
 * SDK LanguageModel, and update `last_used_at` on the chosen key.
 *
 * Order of preference:
 *   1. User's most-recently-used BYO key for this provider.
 *   2. Server default from env (if configured).
 *   3. Throws.
 */
export async function resolveModel(choice: ModelChoice): Promise<ResolvedModel> {
  if (!choice.useServerDefault && choice.userId) {
    const byo = await findUserKey(choice.userId, choice.provider);
    if (byo) {
      const apiKey = await decryptApiKey({
        ciphertext: byo.encryptedKey,
        nonce: byo.nonce,
      });
      const resolved: ResolvedKey = {
        provider: choice.provider,
        apiKey,
        baseUrl: byo.baseUrl ?? undefined,
      };
      // Touch last_used_at so we can surface key usage in the UI.
      await db
        .update(schema.userLlmKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(schema.userLlmKeys.id, byo.id));

      return {
        model: getModel(resolved, choice.modelId),
        source: 'byo',
        keyLabel: byo.label,
      };
    }
  }

  const fallback = getServerDefaultKey(choice.provider);
  if (!fallback) {
    throw new Error(
      `No API key for provider "${choice.provider}". Add one in Settings or set the corresponding server env var.`
    );
  }
  return {
    model: getModel(fallback, choice.modelId),
    source: 'server-default',
  };
}

async function findUserKey(userId: string, provider: ProviderId) {
  const rows = await db
    .select()
    .from(schema.userLlmKeys)
    .where(
      and(
        eq(schema.userLlmKeys.userId, userId),
        eq(schema.userLlmKeys.provider, provider)
      )
    )
    .orderBy(desc(sql`coalesce(${schema.userLlmKeys.lastUsedAt}, ${schema.userLlmKeys.createdAt})`))
    .limit(1);
  return rows[0];
}
