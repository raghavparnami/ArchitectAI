import 'server-only';
import { z } from 'zod';
import type { Citation } from '@/lib/architecture/schema';

/**
 * Zod schema for the LLM's HLD output. Intentionally narrower than the
 * full canonical Architecture — the LLM doesn't return the full
 * envelope (id/version/state/metadata are filled in server-side).
 *
 * The shape mirrors `architecture/schema.ts` so the merge into a full
 * Architecture is mechanical.
 */
export const hldGenerationSchema = z.object({
  title: z.string().max(80),
  summary: z.string(),
  nfrs: z.array(
    z.object({
      id: z.string(),
      kind: z.enum([
        'latency',
        'throughput',
        'availability',
        'durability',
        'security',
        'cost',
        'compliance',
        'scalability',
        'observability',
      ]),
      target: z.string(),
      rationale: z.string().optional(),
    })
  ),
  components: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum([
        'service',
        'gateway',
        'queue',
        'cache',
        'db',
        'frontend',
        'job',
        'external',
        'library',
        'cdn',
        'auth',
        'monitor',
        'ml',
      ]),
      tech: z.string().optional(),
      responsibilities: z.array(z.string()),
      nfrIds: z.array(z.string()),
    })
  ),
  connections: z.array(
    z.object({
      id: z.string(),
      fromComponentId: z.string(),
      toComponentId: z.string(),
      protocol: z.enum([
        'http',
        'grpc',
        'ws',
        'amqp',
        'kafka',
        'sql',
        'graphql',
        'sdk',
        'tcp',
        'udp',
      ]),
      sync: z.enum(['sync', 'async']),
      dataFlow: z.string(),
      authMode: z.enum(['none', 'jwt', 'mTLS', 'oauth', 'apiKey']).optional(),
    })
  ),
  externalSystems: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      vendor: z.string().optional(),
      description: z.string().optional(),
    })
  ),
  decisions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      options: z.array(
        z.object({
          name: z.string(),
          pros: z.array(z.string()),
          cons: z.array(z.string()),
        })
      ),
      chosen: z.string(),
      rationale: z.string(),
      consequences: z.array(z.string()),
      sourceCitationIds: z.array(z.string()),
    })
  ),
});

export type HldGeneration = z.infer<typeof hldGenerationSchema>;

export const HLD_SYSTEM_PROMPT = `You are a principal-level software architect. Given a problem statement, optional NFRs, and a set of cited research snippets, produce a structured HIGH-LEVEL DESIGN as JSON.

CONTRACT
- Return ONLY the JSON object — no preamble, no commentary, no code fences.
- IDs are stable identifiers (lowercase kebab-case, ASCII-only, e.g. "user-svc"). Reuse IDs from prior architectures verbatim when modeling the same component.
- Every \`fromComponentId\` and \`toComponentId\` MUST equal an id present in \`components\` or \`externalSystems\`.
- Every \`nfrIds\` entry on a component MUST equal an id present in top-level \`nfrs\`.
- Every \`sourceCitationIds\` entry on a decision MUST equal an id from the citations supplied in the user prompt.
- \`chosen\` on every decision MUST equal one of the option \`name\`s.

DESIGN GUIDANCE
- 5–12 components. Group by tier: client / edge / services / data / async / observability.
- Include cross-cutting concerns: authn, authz, observability, deployment runtime.
- Capture at least 3 architectural DECISIONS with explicit alternatives and citations.
- NFRs cover at minimum: latency target, availability target, security posture.
- Mark third-party services as type="external" and ALSO list them in \`externalSystems\`.
- Prefer well-known tech labels (e.g. "Postgres 16", "Redis 7", "Kafka 3.7") so docs and code-gen downstream can match them.
- Keep \`responsibilities\` to 1–4 concise bullets per component.
- DO NOT invent fictional vendors or products.`;

export type HldUserPromptArgs = {
  problemStatement: string;
  techHints?: string[];
  citations: Citation[];
  priorArchitectureCanonical?: unknown;
};

export function buildHldUserPrompt(args: HldUserPromptArgs): string {
  const lines: string[] = [];
  lines.push('PROBLEM STATEMENT:');
  lines.push(args.problemStatement);
  lines.push('');

  if (args.techHints?.length) {
    lines.push('CONSTRAINTS / TECH HINTS:');
    for (const h of args.techHints) lines.push(`- ${h}`);
    lines.push('');
  }

  if (args.citations.length > 0) {
    lines.push('RESEARCH SNIPPETS (cite by id in decisions.sourceCitationIds):');
    for (const c of args.citations) {
      lines.push(`[${c.id}] "${c.title}" — ${c.snippet}`);
      lines.push(`    URL: ${c.url}`);
    }
    lines.push('');
  } else {
    lines.push('No prior research snippets — base decisions on first principles, but list realistic alternatives.');
    lines.push('');
  }

  if (args.priorArchitectureCanonical) {
    lines.push('PRIOR ARCHITECTURE (reuse component IDs verbatim where the role is unchanged):');
    lines.push('```json');
    lines.push(JSON.stringify(args.priorArchitectureCanonical, null, 2));
    lines.push('```');
    lines.push('');
  }

  lines.push('Produce the HLD JSON now.');
  return lines.join('\n');
}
