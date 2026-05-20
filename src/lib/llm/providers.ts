import 'server-only';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'openrouter'
  | 'google'
  | 'databricks'
  | 'custom';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Default model per provider. Override per-request via `getModel(_, modelId)`.
 *
 * - anthropic: claude-sonnet-4-6 (Messages API)
 * - google: gemini-2.5-pro (Generative Language API)
 * - databricks: served via the workspace's OpenAI-compatible endpoint;
 *   the model id is the *serving endpoint name* (e.g.
 *   "databricks-claude-sonnet-4" or whatever the workspace exposes).
 * - openai/custom: gpt-4o; baseUrl override allowed for self-hosted.
 */
export const DEFAULT_MODELS: Record<ProviderId, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  openrouter: 'deepseek/deepseek-chat',
  google: 'gemini-2.5-pro',
  databricks: 'databricks-claude-sonnet-4',
  custom: 'gpt-4o',
};

export type ResolvedKey = {
  provider: ProviderId;
  apiKey: string;
  /**
   * For provider='custom' (self-hosted, OpenAI-compatible) AND
   * provider='databricks' (workspace URL). Databricks expects the URL
   * pattern `https://<workspace>.cloud.databricks.com/serving-endpoints`.
   */
  baseUrl?: string;
};

/**
 * Per-task routing tiers. Each project's LLM config maps these tiers to
 * a concrete (provider, modelId). Defaults shipped here; per-project
 * overrides live in the LlmProviderConfig table (M1+).
 */
export type TaskTier =
  | 'cheap' // batch, latency-tolerant: AST chunk summaries, SQL classify
  | 'strong' // user-facing synthesis: architecture generation, validation
  | 'vision' // image → canonical
  | 'embed'; // embeddings

export const DEFAULT_TIER_TO_MODEL: Record<
  TaskTier,
  { provider: ProviderId; modelId: string }
> = {
  cheap: { provider: 'openrouter', modelId: 'deepseek/deepseek-chat' },
  strong: { provider: 'openrouter', modelId: 'deepseek/deepseek-chat' },
  vision: { provider: 'openrouter', modelId: 'deepseek/deepseek-chat' },
  embed: { provider: 'openrouter', modelId: 'deepseek/deepseek-chat' },
};

export function getModel(resolved: ResolvedKey, modelId?: string): LanguageModel {
  const id = modelId ?? DEFAULT_MODELS[resolved.provider];

  switch (resolved.provider) {
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey: resolved.apiKey });
      return google(id);
    }
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: resolved.apiKey,
        ...(resolved.baseUrl ? { baseURL: resolved.baseUrl } : {}),
      });
      return anthropic(id);
    }
    case 'databricks': {
      // Databricks Foundation Model serving endpoints speak OpenAI's
      // chat/completions wire format. Auth header is the PAT.
      const baseUrl = normalizeDatabricksBaseUrl(resolved.baseUrl);
      const openai = createOpenAI({
        apiKey: resolved.apiKey,
        baseURL: baseUrl,
        // Databricks doesn't expose the OpenAI org header.
        compatibility: 'compatible',
      });
      return openai(id);
    }
    case 'openai': {
      const openai = createOpenAI({
        apiKey: resolved.apiKey,
        ...(resolved.baseUrl ? { baseURL: resolved.baseUrl } : {}),
      });
      return openai(id);
    }
    case 'openrouter': {
      const openrouter = createOpenAI({
        apiKey: resolved.apiKey,
        baseURL: resolved.baseUrl ?? OPENROUTER_BASE_URL,
        compatibility: 'compatible',
        headers: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5176',
          'X-Title': 'ArchitectAI',
        },
        // OpenRouter supports per-request `provider` routing preferences
        // (https://openrouter.ai/docs/provider-routing). The Vercel AI SDK
        // doesn't expose this directly, so we intercept the outbound fetch
        // and inject the field into the JSON body. `allow_fallbacks` lets
        // OpenRouter try a different upstream when one (e.g. DeepInfra) is
        // rate-limited — exactly the 429 we saw on deepseek/deepseek-chat.
        fetch: async (url, init) => {
          if (init && typeof init.body === 'string') {
            try {
              const parsed = JSON.parse(init.body);
              parsed.provider = {
                allow_fallbacks: true,
                sort: 'throughput',
              };
              init.body = JSON.stringify(parsed);
            } catch {
              // Non-JSON body — leave as-is.
            }
          }
          return fetch(url, init);
        },
      });
      return openrouter(id);
    }
    case 'custom': {
      // OpenAI-compatible. Required: baseUrl. Used for self-hosted
      // vLLM/Ollama/TGI endpoints behind the customer's perimeter.
      if (!resolved.baseUrl) {
        throw new Error(
          'provider="custom" requires `baseUrl` (OpenAI-compatible endpoint).'
        );
      }
      const openai = createOpenAI({
        apiKey: resolved.apiKey,
        baseURL: resolved.baseUrl,
        compatibility: 'compatible',
      });
      return openai(id);
    }
    default: {
      const _exhaustive: never = resolved.provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

export function getServerDefaultKey(provider: ProviderId): ResolvedKey | null {
  switch (provider) {
    case 'google': {
      const apiKey =
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
      return apiKey ? { provider, apiKey } : null;
    }
    case 'anthropic': {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      return apiKey ? { provider, apiKey } : null;
    }
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      return apiKey ? { provider, apiKey } : null;
    }
    case 'openrouter': {
      const apiKey = process.env.OPENROUTER_API_KEY;
      return apiKey ? { provider, apiKey, baseUrl: OPENROUTER_BASE_URL } : null;
    }
    case 'databricks': {
      const apiKey =
        process.env.DATABRICKS_TOKEN ?? process.env.DATABRICKS_PAT;
      const baseUrl =
        process.env.DATABRICKS_BASE_URL ?? process.env.DATABRICKS_WORKSPACE_URL;
      return apiKey && baseUrl ? { provider, apiKey, baseUrl } : null;
    }
    case 'custom':
      return null;
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

/**
 * Capabilities reported per (provider, model). The orchestrator uses this
 * to pick a fallback path for providers/models without native tool use.
 */
export type Capabilities = {
  tools: boolean;
  vision: boolean;
  jsonMode: boolean;
  streaming: boolean;
  maxContextTokens: number;
};

export function capabilitiesFor(
  provider: ProviderId,
  modelId: string
): Capabilities {
  switch (provider) {
    case 'anthropic':
      return {
        tools: true,
        vision: true,
        jsonMode: true,
        streaming: true,
        maxContextTokens: 200_000,
      };
    case 'google':
      return {
        tools: true,
        vision: true,
        jsonMode: true,
        streaming: true,
        maxContextTokens: 1_000_000,
      };
    case 'openai':
      return {
        tools: true,
        vision: modelId.includes('4o') || modelId.includes('vision'),
        jsonMode: true,
        streaming: true,
        maxContextTokens: 128_000,
      };
    case 'openrouter':
      return {
        tools: true,
        vision: modelId.includes('vision') || modelId.includes('gpt-4o') || modelId.includes('claude'),
        jsonMode: true,
        streaming: true,
        maxContextTokens: modelId.includes('deepseek') ? 64_000 : 128_000,
      };
    case 'databricks':
      // Capability depends on which model the serving endpoint hosts.
      // Conservative default: tools+json work for Claude/GPT-class models;
      // older Llama endpoints may not. Caller can override per project.
      return {
        tools: modelId.toLowerCase().includes('claude') ||
          modelId.toLowerCase().includes('gpt'),
        vision: false,
        jsonMode: true,
        streaming: true,
        maxContextTokens: 32_000,
      };
    case 'custom':
      return {
        tools: false,
        vision: false,
        jsonMode: true,
        streaming: true,
        maxContextTokens: 8_000,
      };
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

/**
 * Databricks workspace URL → OpenAI-compatible serving base URL.
 * Accepts:
 *   - https://acme.cloud.databricks.com
 *   - https://acme.cloud.databricks.com/
 *   - https://acme.cloud.databricks.com/serving-endpoints
 * Returns: https://acme.cloud.databricks.com/serving-endpoints
 *
 * The Vercel AI SDK's `createOpenAI` appends `/chat/completions` to the
 * baseURL, so we stop at `/serving-endpoints` (the parent path).
 */
function normalizeDatabricksBaseUrl(input: string | undefined): string {
  if (!input) {
    throw new Error(
      'provider="databricks" requires `baseUrl` (Databricks workspace URL or serving-endpoints URL).'
    );
  }
  let url = input.trim().replace(/\/+$/, '');
  if (!url.endsWith('/serving-endpoints')) {
    url = `${url}/serving-endpoints`;
  }
  return url;
}
