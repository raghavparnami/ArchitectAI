import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { TECH_CATALOG } from '@/lib/tech-catalog';
import { DiagramConnection, DiagramNode } from '@/lib/types';
import { sanitizeLabel, sanitizeEdgeLabel } from '@/lib/labels';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    nodes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          label: { type: SchemaType.STRING },
          techId: { type: SchemaType.STRING },
          type: { type: SchemaType.STRING },
          x: { type: SchemaType.NUMBER },
          y: { type: SchemaType.NUMBER },
          desc: { type: SchemaType.STRING },
        },
        required: ['id', 'label', 'type', 'x', 'y'],
      },
    },
    connections: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          fromNodeId: { type: SchemaType.STRING },
          toNodeId: { type: SchemaType.STRING },
          label: { type: SchemaType.STRING },
        },
        required: ['id', 'fromNodeId', 'toNodeId'],
      },
    },
    changeSummary: { type: SchemaType.STRING },
  },
  required: ['nodes', 'connections', 'changeSummary'],
};

const SYSTEM_PROMPT = `You are a senior software architect refining a system architecture by applying a list of recommendations.

You receive the current diagram and a list of recommendations to apply. Apply them all and return the updated full diagram.

Rules:
- Preserve existing node IDs whenever possible; mint new ones for additions
- Preserve the user's existing layout when sensible — only re-layout if necessary
- node.x: integer 80-700. node.y: integer 80-560.
- node.label: PLAIN TEXT, max 3 words. NO surrounding quotes. NO literal "\\n"
- node.type: service|database|queue|gateway|frontend|cache|auth|monitor|cdn|ml|external
- connection.label: max 18 chars
- changeSummary: 2-3 sentences describing what changed and why
- Prioritize the highest-impact recommendations first if they conflict`;

interface ImproveBody {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  recommendations: string[];
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  let body: ImproveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { nodes, connections, recommendations } = body;
  if (!recommendations || recommendations.length === 0) {
    return NextResponse.json({ error: 'No recommendations to apply' }, { status: 400 });
  }

  const techCatalogList = TECH_CATALOG.map((t) => `  ${t.id} (${t.label})`).join('\n');

  const userPrompt = [
    'Recommendations to apply:',
    ...recommendations.map((r, i) => `${i + 1}. ${r}`),
    '',
    `Current nodes:\n${JSON.stringify(nodes, null, 2)}`,
    '',
    `Current connections:\n${JSON.stringify(connections, null, 2)}`,
    '',
    `Available tech ids:\n${techCatalogList}`,
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

    const validTechIds = new Set(TECH_CATALOG.map((t) => t.id));
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outNodes: DiagramNode[] = (parsed.nodes as any[]).map((n, i) => ({
      id: String(n.id || `node_${Date.now()}_${i}`),
      label: sanitizeLabel(n.label) || 'Node',
      techId: n.techId && validTechIds.has(n.techId) ? n.techId : undefined,
      type: n.type || 'service',
      x: clamp(Number(n.x) || 100, 80, 700),
      y: clamp(Number(n.y) || 100, 60, 560),
      width: 180,
      height: 96,
      desc: String(n.desc || '').slice(0, 80),
    }));

    const validIds = new Set(outNodes.map((n) => n.id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outConns: DiagramConnection[] = (parsed.connections as any[])
      .filter((c) => validIds.has(c.fromNodeId) && validIds.has(c.toNodeId) && c.fromNodeId !== c.toNodeId)
      .map((c, i) => ({
        id: String(c.id || `conn_${Date.now()}_${i}`),
        fromNodeId: c.fromNodeId,
        toNodeId: c.toNodeId,
        fromPort: 's' as const,
        toPort: 'n' as const,
        label: sanitizeEdgeLabel(c.label),
      }));

    return NextResponse.json({
      nodes: outNodes,
      connections: outConns,
      changeSummary: String(parsed.changeSummary || ''),
    });
  } catch (err) {
    console.error('Improve error:', err);
    return NextResponse.json({ error: 'Improve failed' }, { status: 500 });
  }
}
