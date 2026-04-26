import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DiagramNode, DiagramConnection } from '@/lib/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    overallScore: { type: SchemaType.NUMBER },
    summary: { type: SchemaType.STRING },
    dimensions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          score: { type: SchemaType.NUMBER },
          rationale: { type: SchemaType.STRING },
          findings: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['name', 'score', 'rationale', 'findings'],
      },
    },
    risks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    recommendations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    estimatedMonthlyCost: { type: SchemaType.STRING },
  },
  required: ['overallScore', 'summary', 'dimensions', 'risks', 'recommendations'],
};

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
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

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
    problemStatement ? `Original problem: ${problemStatement}` : 'No original problem statement provided.',
    '',
    `Nodes (${nodes.length}):`,
    ...nodes.map((n) => `  - ${n.label} [${n.type}${n.techId ? ` · ${n.techId}` : ''}]${n.desc ? ` — ${n.desc}` : ''}`),
    '',
    `Connections (${connections.length}):`,
    ...connections.map((c) => {
      const from = nodes.find((n) => n.id === c.fromNodeId)?.label ?? c.fromNodeId;
      const to = nodes.find((n) => n.id === c.toNodeId)?.label ?? c.toNodeId;
      return `  - ${from} → ${to}${c.label ? ` (${c.label})` : ''}`;
    }),
  ].join('\n');

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: RESPONSE_SCHEMA as any,
        temperature: 0.3,
      },
    });

    const result = await model.generateContent(userPrompt);
    const parsed = JSON.parse(result.response.text());
    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Evaluate error:', err);
    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 });
  }
}
