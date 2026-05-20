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
};

/**
 * Single-provider wrapper around `generateObject` that always routes through
 * OpenRouter + DeepSeek. No Gemini fallback by design — the only LLM key the
 * deploy needs is `OPENROUTER_API_KEY`.
 *
 * Returns `{ object, source: 'openrouter' }`.
 */
export async function safeGenerateObject<T extends z.ZodTypeAny>(
  args: Args<T>
): Promise<{ object: z.infer<T>; source: 'openrouter' }> {
  const {
    schema,
    system,
    prompt,
    temperature = 0.3,
    primaryModelId = 'deepseek/deepseek-chat',
  } = args;

  const orKey = getServerDefaultKey('openrouter');
  if (!orKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not set. Add it to your env and restart the server.'
    );
  }

  const model: LanguageModel = getModel(orKey, primaryModelId);
  const result = (await generateObject({
    model,
    schema,
    system,
    prompt,
    mode: 'json',
    temperature,
  })) as GenerateObjectResult<z.infer<T>>;
  return { object: result.object, source: 'openrouter' };
}
