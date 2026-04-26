import 'server-only';
import type { Citation } from '@/lib/architecture/schema';

/**
 * Thin wrapper around Tavily's Search API. We talk to the REST endpoint
 * directly to avoid taking a hard dep on the still-young npm SDK.
 *
 * Docs: https://docs.tavily.com/docs/rest-api/api-reference
 */

export type TavilySearchOptions = {
  query: string;
  /** 'basic' is faster + cheaper; 'advanced' returns longer snippets. */
  searchDepth?: 'basic' | 'advanced';
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
};

export type TavilyResult = {
  url: string;
  title: string;
  content: string;
  score: number;
};

export async function tavilySearch(opts: TavilySearchOptions): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is not set');
  }

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: opts.query,
      search_depth: opts.searchDepth ?? 'advanced',
      max_results: opts.maxResults ?? 5,
      include_domains: opts.includeDomains,
      exclude_domains: opts.excludeDomains,
    }),
    // Tavily occasionally takes ~20s on advanced searches; raise the
    // default fetch timeout via an AbortController.
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Tavily search failed: ${res.status} ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as { results?: TavilyResult[] };
  return json.results ?? [];
}

/**
 * Search and convert results into Citation rows. IDs are deterministic
 * (sha-1 of url + retrieval timestamp) so dedupe is straightforward.
 */
export async function searchForCitations(query: string): Promise<Citation[]> {
  const results = await tavilySearch({ query, maxResults: 6 });
  const retrievedAt = new Date().toISOString();
  return results.map((r, i) => ({
    id: `cit_${shortHash(r.url)}_${i}`,
    url: r.url,
    title: r.title.slice(0, 200),
    // Tavily content is usually a paragraph or two; clip for prompt budget.
    snippet: r.content.slice(0, 600),
    retrievedAt,
  }));
}

function shortHash(s: string): string {
  // Cheap deterministic hash. NOT cryptographic — it's only an id.
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).padStart(7, '0').slice(0, 7);
}
