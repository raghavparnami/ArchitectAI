import 'server-only';
import type { Citation } from '@/lib/architecture/schema';

/**
 * Research stub. The SQLite-Gemini prototype ships without an external
 * web search provider — the LLM falls back to first-principles
 * reasoning per the HLD prompt's "no prior research snippets" branch.
 *
 * To wire real research later, replace this file with one of:
 *
 *   1. Gemini grounding with Google Search — Vercel AI SDK supports it
 *      via `google.tools.googleSearch()` on the request, no extra key
 *      needed beyond GOOGLE_GENERATIVE_AI_API_KEY. Pull groundedSources
 *      out of the response and map to Citation[].
 *
 *   2. Tavily — set TAVILY_API_KEY and POST to api.tavily.com/search.
 *
 *   3. Brave Search API — free 2k/month at api.search.brave.com.
 *
 *   4. Exa — semantic search, free tier at api.exa.ai.
 *
 * The function signature MUST stay the same so callers (Inngest jobs,
 * the regenerate flow) don't have to change.
 */

export async function searchForCitations(_query: string): Promise<Citation[]> {
  // No-op until a research provider is configured. Returning an empty
  // array is the same code path the LLM uses when Tavily is down.
  return [];
}
