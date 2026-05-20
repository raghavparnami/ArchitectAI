import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { safeGenerateObject } from '@/lib/llm/safeGenerate';
import { DiagramNode, DiagramConnection } from '@/lib/types';

const evalSchema = z.object({
  overallScore: z.number(),
  summary: z.string(),
  dimensions: z.array(
    z.object({
      name: z.string(),
      score: z.number(),
      rationale: z.string(),
      findings: z.array(z.string()),
    })
  ),
  risks: z.array(z.string()),
  recommendations: z.array(z.string()),
  estimatedMonthlyCost: z.string().optional(),
});

const SYSTEM_PROMPT = `You are a principal-level software architect performing a technical review of a system architecture diagram.

Score the architecture across 6 dimensions, each on a 0-10 scale:
1. Scalability — can it handle 10x and 100x growth?
2. Reliability — fault tolerance, redundancy, blast radius
3. Cost Efficiency — over-provisioning, expensive components, opportunities for cheaper alternatives
4. Security — exposed surfaces, auth/authz, data protection
5. Maintainability — complexity, coupling, observability
6. Performance — latency hotspots, caching, async patterns

For each dimension provide:
- score (0-10, where 10 is excellent)
- rationale (1 sentence)
- findings: 2-4 specific observations about THIS architecture (not generic advice)

Also provide:
- overallScore: the average of the 6 dimensions, rounded to one decimal
- summary: 2 sentences capturing the architecture's profile
- risks: 3-5 specific risks ranked most-critical first
- recommendations: 3-5 concrete improvements ranked by impact
- estimatedMonthlyCost: rough $ range string (e.g. "$200-$500/mo on AWS at low traffic")

Be specific. Reference actual node labels. No generic platitudes.`;

interface EvalBody {
  problemStatement?: string;
  nodes: DiagramNode[];
  connections: DiagramConnection[];
}

export async function POST(req: NextRequest) {
  // DEMO BYPASS — original auth check:
  // const { userId } = await auth();
  // if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: EvalBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { problemStatement, nodes, connections } = body;
  if (!nodes || nodes.length === 0) {
    return NextResponse.json({ error: 'Diagram is empty' }, { status: 400 });
  }

  const userPrompt = [
    problemStatement
      ? `Original problem: ${problemStatement}`
      : 'No original problem statement provided.',
    '',
    `Nodes (${nodes.length}):`,
    ...nodes.map(
      (n) =>
        `  - ${n.label} [${n.type}${n.techId ? ` · ${n.techId}` : ''}]${n.desc ? ` — ${n.desc}` : ''}`
    ),
    '',
    `Connections (${connections.length}):`,
    ...connections.map((c) => {
      const from = nodes.find((n) => n.id === c.fromNodeId)?.label ?? c.fromNodeId;
      const to = nodes.find((n) => n.id === c.toNodeId)?.label ?? c.toNodeId;
      return `  - ${from} → ${to}${c.label ? ` (${c.label})` : ''}`;
    }),
  ].join('\n');

  try {
    const { object, source } = await safeGenerateObject({
      schema: evalSchema,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.3,
    });
    return NextResponse.json({ ...object, source });
  } catch (err) {
    console.error('Evaluate error:', err);
    const message = err instanceof Error ? err.message : 'Evaluation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
