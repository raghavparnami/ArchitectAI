import 'server-only';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

export type ProviderId = 'anthropic' | 'openai' | 'google' | 'custom';

/**
 * Default model per provider. The user can override per-request via the
 * `model` arg on `getModel()`.
 *
 * Note: We prefer Claude Sonnet 4.6 as the system default — it's the
 * sweet spot for reasoning + cost on architecture work. Gemini Flash is
 * used as the cheap fallback. Adjust here, not at every call site.
 */
export const DEFAULT_MODELS: Record<ProviderId, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  google: 'gemini-2.5-pro',
  custom: 'gpt-4o', // assumes OpenAI-compatible endpoint; user can override
};

export type ResolvedKey = {
  provider: ProviderId;
  apiKey: string;
  /** For provider='custom' (self-hosted, OpenAI-compatible). */
  baseUrl?: string;
};

/**
 * Build a Vercel AI SDK LanguageModel for the given provider/key. The
 * caller is responsible for sourcing the key (BYO from the DB, or the
 * server default from env).
 */
export function getModel(resolved: ResolvedKey, modelId?: string): LanguageModel {
  const id = modelId ?? DEFAULT_MODELS[resolved.provider];

  switch (resolved.provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey: resolved.apiKey });
      return anthropic(id);
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey: resolved.apiKey });
      return openai(id);
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey: resolved.apiKey });
      return google(id);
    }
    case 'custom': {
      // Self-hosted, OpenAI-compatible (e.g. Ollama, vLLM, LiteLLM proxy).
      if (!resolved.baseUrl) {
        throw new Error("provider='custom' requires baseUrl");
      }
      const compat = createOpenAI({
        apiKey: resolved.apiKey,
        baseURL: resolved.baseUrl,
      });
      return compat(id);
    }
    default: {
      // exhaustiveness check
      const _exhaustive: never = resolved.provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

/**
 * Fall back to the server-side default key for a provider when the user
 * hasn't configured BYO. Returns null if no env key is set, in which
 * case the route should 400 with "no key configured".
 */
export function getServerDefaultKey(provider: ProviderId): ResolvedKey | null {
  const envName: Record<ProviderId, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    google:
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY,
    custom: undefined, // there is no "default" custom; user must BYO
  };
  const apiKey = envName[provider];
  if (!apiKey) return null;
  return { provider, apiKey };
}
