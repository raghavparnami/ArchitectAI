import 'server-only';
import {
  generateObject,
  type GenerateObjectResult,
  type LanguageModel,
} from 'ai';
import type { z } from 'zod';
import { getModel, getServerDefaultKey } from './providers';

type Args<T extends z.ZodTypeAny> = {
  schema: T;
  system: string;
  prompt: string;
  temperature?: number;
  // Override the OpenRouter model id (defaults to deepseek/deepseek-chat).
  primaryModelId?: string;
  // Override the Gemini fallback id (defaults to gemini-2.5-flash for speed).
  fallbackModelId?: string;
  // For heavy prompts (evaluate, improve) where free-tier OpenRouter routes
  // are flaky, try Gemini Flash FIRST. Keeps demo latency predictable.
  preferGemini?: boolean;
};

/**
 * Run generateObject against OpenRouter+DeepSeek, but if OpenRouter is rate-
 * limited (429), times out, or otherwise errors, transparently fall back to
 * Gemini so the demo doesn't stall on free-tier throttling. Both keys live in
 * `.env.local` (OPENROUTER_API_KEY + GOOGLE_GENERATIVE_AI_API_KEY).
 *
 * Returns `{ object, source: 'openrouter' | 'gemini' }`.
 */
export async function safeGenerateObject<T extends z.ZodTypeAny>(
  args: Args<T>
): Promise<{ object: z.infer<T>; source: 'openrouter' | 'gemini' }> {
  const {
    schema,
    system,
    prompt,
    temperature = 0.3,
    primaryModelId = 'deepseek/deepseek-chat',
    fallbackModelId = 'gemini-1.5-flash',
    preferGemini = false,
  } = args;

  const tryOpenRouter = async (): Promise<{ object: z.infer<T>; source: 'openrouter' } | null> => {
    const orKey = getServerDefaultKey('openrouter');
    if (!orKey) return null;
    try {
      const model: LanguageModel = getModel(orKey, primaryModelId);
      // No timeout: user wants OpenRouter+DeepSeek end-to-end. Gemini below
      // is only a last-resort failsafe for hard errors (auth, network), not a
      // latency-based punt.
      const result = (await generateObject({
        model,
        schema,
        system,
        prompt,
        mode: 'json',
        temperature,
      })) as GenerateObjectResult<z.infer<T>>;
      return { object: result.object, source: 'openrouter' };
    } catch (err) {
      console.warn(
        '[safeGenerateObject] OpenRouter failed:',
        err instanceof Error ? err.message : err
      );
      return null;
    }
  };

  const tryGemini = async (): Promise<{ object: z.infer<T>; source: 'gemini' } | null> => {
    const geminiKey = getServerDefaultKey('google');
    if (!geminiKey) return null;
    try {
      const model: LanguageModel = getModel(geminiKey, fallbackModelId);
      const result = (await generateObject({
        model,
        schema,
        system,
        prompt,
        mode: 'json',
        temperature,
      })) as GenerateObjectResult<z.infer<T>>;
      return { object: result.object, source: 'gemini' };
    } catch (err) {
      console.warn(
        '[safeGenerateObject] Gemini failed:',
        err instanceof Error ? err.message : err
      );
      return null;
    }
  };

  // For heavy prompts, hit Gemini first (faster, more reliable free tier).
  // For light prompts, hit OpenRouter first (honors the explicit preference).
  const first = preferGemini ? tryGemini : tryOpenRouter;
  const second = preferGemini ? tryOpenRouter : tryGemini;

  const a = await first();
  if (a) return a;
  const b = await second();
  if (b) return b;

  throw new Error(
    'No LLM providers responded. Check OPENROUTER_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY in .env.local.'
  );
}
