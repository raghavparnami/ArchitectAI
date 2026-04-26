import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { TECH_CATALOG } from '@/lib/tech-catalog';
import { DiagramNode, DiagramConnection } from '@/lib/types';
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
          id:     { type: SchemaType.STRING },
          label:  { type: SchemaType.STRING },
          techId: { type: SchemaType.STRING },
          type:   { type: SchemaType.STRING },
          x:      { type: SchemaType.NUMBER },
          y:      { type: SchemaType.NUMBER },
          desc:   { type: SchemaType.STRING },
        },
        required: ['id', 'label', 'type', 'x', 'y'],
      },
    },
    connections: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id:         { type: SchemaType.STRING },
          fromNodeId: { type: SchemaType.STRING },
          toNodeId:   { type: SchemaType.STRING },
          label:      { type: SchemaType.STRING },
        },
        required: ['id', 'fromNodeId', 'toNodeId'],
      },
    },
    suggestions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    explanation: { type: SchemaType.STRING },
  },
  required: ['nodes', 'connections'],
};

const SYSTEM_PROMPT = `You are a senior software architect refining an existing architecture diagram.

You receive the current diagram (nodes + connections) and a refinement instruction from the user.
Apply the instruction and return the FULL updated diagram as JSON.

Rules:
- Preserve existing node IDs whenever a node is unchanged or only modified.
- Generate fresh ids ("node_XYZ", "conn_XYZ") for newly added nodes/connections.
- node.x: integer 80-700. node.y: integer 80-560. Re-layout if necessary so labels do not overlap.
- node.label: PLAIN TEXT, max 3 words. NO surrounding quotes. NO literal "\\n"
- node.type: one of service|database|queue|gateway|frontend|cache|auth|monitor|cdn|ml|external.
- node.techId: an id from the provided catalog, or empty string.
- connection.fromNodeId/toNodeId must reference an existing node id from the returned nodes array.
- connection.label: protocol or data type, max 2 words. NEVER more than 18 characters.
- Provide 3 NEW suggestions reflecting the refined architecture.
- explanation: 1-2 sentence summary of what you changed.`;

interface RefineBody {
  instruction: string;
  nodes: DiagramNode[];
  connections: DiagramConnection[];
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  let body: RefineBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { instruction, nodes, connections } = body;
  if (!instruction || instruction.trim().length < 3) {
    return NextResponse.json({ error: 'Instruction required' }, { status: 400 });
  }

  const techCatalogList = TECH_CATALOG.map(t => `  ${t.id} (${t.label})`).join('\n');

  const userPrompt = [
    `Refinement instruction: ${instruction}`,
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

    const validTechIds = new Set(TECH_CATALOG.map(t => t.id));
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

    const validIds = new Set(outNodes.map(n => n.id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outConns: DiagramConnection[] = (parsed.connections as any[])
      .filter(c => validIds.has(c.fromNodeId) && validIds.has(c.toNodeId) && c.fromNodeId !== c.toNodeId)
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
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 3).map((s: unknown) => String(s))
        : [],
      explanation: String(parsed.explanation || ''),
    });
  } catch (err) {
    console.error('Refine error:', err);
    return NextResponse.json({ error: 'Refinement failed' }, { status: 500 });
  }
}
