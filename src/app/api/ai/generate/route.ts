import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { TECH_CATALOG } from '@/lib/tech-catalog';
import { AIGenerationRequest } from '@/lib/types';
import { sanitizeLabel, sanitizeEdgeLabel } from '@/lib/labels';
import { autoLayout } from '@/lib/layout';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    nodes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          label: { type: SchemaType.STRING },
          techId: { type: SchemaType.STRING },
          type: { type: SchemaType.STRING },
          x: { type: SchemaType.NUMBER },
          y: { type: SchemaType.NUMBER },
          desc: { type: SchemaType.STRING },
        },
        required: ['label', 'type', 'x', 'y', 'desc'],
      },
    },
    connections: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          fromNodeId: { type: SchemaType.STRING },
          toNodeId: { type: SchemaType.STRING },
          label: { type: SchemaType.STRING },
        },
        required: ['fromNodeId', 'toNodeId', 'label'],
      },
    },
    suggestions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: ['title', 'nodes', 'connections', 'suggestions'],
};

const SYSTEM_PROMPT = `You are a senior software architect. Given a problem statement and tech stack, generate a software architecture diagram as structured JSON.

Rules:
- Generate 6–10 nodes. No more, no less.
- title: max 4 words, descriptive.
- node.label: service name, max 3 words. PLAIN TEXT ONLY — no surrounding quotes, no literal "\\n".
- node.type: one of service|database|queue|gateway|frontend|cache|auth|monitor|cdn|ml|external.
- node.techId: an id from the provided catalog, or empty string if none fits.
- node.x: integer 80 to 700. node.y: integer 80 to 560.
- Layer the architecture top-to-bottom: Frontend (y≈80-140), API/Gateway (y≈220-280), Services (y≈360-440), Data (y≈500-560).
- Spread nodes horizontally so labels do not overlap. Keep ≥220px horizontal gap between siblings.
- node.desc: one line, max 8 words.
- connections: every fromNodeId/toNodeId must equal an existing node.label EXACTLY (case-insensitive).
- connection.label: protocol or data type, max 2 words (e.g. "HTTP", "Events", "SQL"). NEVER more than 18 characters.
- suggestions: exactly 3 actionable architectural improvements specific to this design, max 15 words each.`;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured on server' },
      { status: 500 }
    );
  }

  let body: AIGenerationRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { problemStatement, techStack, orgInstructions } = body;
  if (!problemStatement || problemStatement.trim().length < 10) {
    return NextResponse.json(
      { error: 'Problem statement must be at least 10 characters' },
      { status: 400 }
    );
  }

  const techCatalogList = TECH_CATALOG
    .map(t => `  ${t.id} (${t.label}, category: ${t.category})`)
    .join('\n');

  const selectedTechNames = techStack
    .map(id => TECH_CATALOG.find(t => t.id === id)?.label)
    .filter(Boolean)
    .join(', ');

  const userPrompt = [
    `Problem statement: ${problemStatement}`,
    selectedTechNames
      ? `Required tech stack: ${selectedTechNames}`
      : 'Tech stack: choose the most appropriate technologies from the catalog.',
    orgInstructions ? `Organisation-specific rules: ${orgInstructions}` : null,
    '',
    'Available tech catalog (use these ids verbatim for techId):',
    techCatalogList,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        // Use schema to guarantee JSON structure
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: RESPONSE_SCHEMA as any,
        temperature: 0.4,
      },
    });

    const result = await model.generateContent(userPrompt);
    const rawText = result.response.text();
    const parsed = JSON.parse(rawText);

    // Post-process: assign stable IDs, resolve label refs, clamp coords.
    const validTechIds = new Set(TECH_CATALOG.map(t => t.id));
    const clamp = (v: number, lo: number, hi: number) =>
      Math.max(lo, Math.min(hi, v));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawNodes = (parsed.nodes as any[]).map((n, i) => ({
      id: `node_${Date.now()}_${i}`,
      label: sanitizeLabel(n.label) || `Node ${i + 1}`,
      techId: n.techId && validTechIds.has(n.techId) ? n.techId : undefined,
      type: n.type || 'service',
      x: clamp(Number(n.x) || 100, 80, 700),
      y: clamp(Number(n.y) || 100, 60, 560),
      width: 180,
      height: 96,
      desc: String(n.desc || '').slice(0, 80),
    }));
    const nodes = autoLayout(rawNodes);

    const labelToId = new Map(nodes.map(n => [n.label.toLowerCase(), n.id]));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connections = (parsed.connections as any[])
      .map((c, i) => {
        const fromId = labelToId.get(String(c.fromNodeId || '').toLowerCase());
        const toId = labelToId.get(String(c.toNodeId || '').toLowerCase());
        if (!fromId || !toId || fromId === toId) return null;
        return {
          id: `conn_${Date.now()}_${i}`,
          fromNodeId: fromId,
          toNodeId: toId,
          fromPort: 's' as const,
          toPort: 'n' as const,
          label: sanitizeEdgeLabel(c.label),
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    return NextResponse.json({
      title: String(parsed.title || 'Untitled Architecture').slice(0, 60),
      nodes,
      connections,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 3).map((s: unknown) => String(s))
        : [],
    });
  } catch (err) {
    console.error('AI generation error:', err);
    return NextResponse.json(
      { error: 'Generation failed. Please try again.' },
      { status: 500 }
    );
  }
}
