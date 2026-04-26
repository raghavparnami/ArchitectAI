import 'server-only';
import { embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

/**
 * Generate a 1536-dim embedding for a citation snippet so we can later
 * search "what did we decide about X" via pgvector cosine similarity.
 *
 * We use OpenAI's text-embedding-3-small because it's cheap, fast, and
 * matches the dimensions baked into the citations table. Switching
 * providers means a schema migration; do it deliberately.
 */

const apiKey = process.env.OPENAI_API_KEY;

export async function embedSnippet(text: string): Promise<number[] | null> {
  if (!apiKey) {
    // Embeddings are nice-to-have, not load-bearing — skip if unconfigured.
    return null;
  }
  const openai = createOpenAI({ apiKey });
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text.slice(0, 8000), // 8k char cap is well under model context
  });
  return embedding;
}
