import 'server-only';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

export type ProviderId = 'anthropic' | 'openai' | 'google' | 'custom';

/**
 * Default model per provider. Override per-request via `getModel(_, modelId)`.
 *
 * SQLite-Gemini prototype: Gemini is the only built-in provider. The
 * other enum values are reserved so the BYO-key schema and the
 * `ProviderId` type stay stable when we wire in additional providers
 * later (each will need its `@ai-sdk/<provider>` package and a branch
 * in `getModel()`).
 */
export const DEFAULT_MODELS: Record<ProviderId, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  google: 'gemini-2.5-pro',
  custom: 'gpt-4o', // assumes OpenAI-compatible endpoint
};

export type ResolvedKey = {
  provider: ProviderId;
  apiKey: string;
  /** For provider='custom' (self-hosted, OpenAI-compatible). */
  baseUrl?: string;
};

export function getModel(resolved: ResolvedKey, modelId?: string): LanguageModel {
  const id = modelId ?? DEFAULT_MODELS[resolved.provider];

  switch (resolved.provider) {
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey: resolved.apiKey });
      return google(id);
    }
    case 'anthropic':
    case 'openai':
    case 'custom':
      throw new Error(
        `Provider "${resolved.provider}" is not enabled in this build. ` +
          `Install @ai-sdk/${
            resolved.provider === 'custom' ? 'openai' : resolved.provider
          } and add a branch in lib/llm/providers.ts.`
      );
    default: {
      const _exhaustive: never = resolved.provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

export function getServerDefaultKey(provider: ProviderId): ResolvedKey | null {
  if (provider === 'google') {
    const apiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
    return apiKey ? { provider, apiKey } : null;
  }
  // Other providers: no server-side default. User must BYO via the
  // settings UI (and the build must include the relevant SDK).
  return null;
}
