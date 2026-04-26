import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { TECH_CATALOG } from '@/lib/tech-catalog';
import { ChatMessage, DiagramConnection, DiagramNode } from '@/lib/types';
import { sanitizeLabel, sanitizeEdgeLabel } from '@/lib/labels';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    reply: { type: SchemaType.STRING },
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
    suggestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['reply', 'nodes', 'connections'],
};

const SYSTEM_PROMPT = `You are a senior software architect helping a user iteratively design a system architecture through conversation.

Given the conversation history and the current diagram state, respond to the user's latest message.
Each turn you MUST return:
- reply: a short conversational response (1-2 sentences) acknowledging what you did
- nodes: the FULL updated nodes array (preserve existing IDs; mint new ones for additions)
- connections: the FULL updated connections array (using the same node IDs)
- suggestions: 3 follow-up actions the user could ask for next

Rules:
- Preserve existing node IDs when a node is unchanged
- New IDs follow the pattern node_xxx / conn_xxx
- node.x: integer 80-700. node.y: integer 80-560.
- Layer top-to-bottom: Frontend (y≈80-140), API/Gateway (y≈220-280), Services (y≈360-440), Data (y≈500-560)
- node.label: PLAIN TEXT, max 3 words. NO surrounding quotes. NO literal "\\n"
- node.type: service|database|queue|gateway|frontend|cache|auth|monitor|cdn|ml|external
- node.techId: id from catalog or empty string
- connection endpoints must reference existing node ids
- connection.label: max 18 chars. Examples: "HTTP", "Events", "SQL"
- Be specific in your reply — say what you added, removed, or changed`;

interface ChatBody {
  messages: ChatMessage[];
  currentNodes: DiagramNode[];
  currentConnections: DiagramConnection[];
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { messages, currentNodes, currentConnections } = body;
  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'Messages required' }, { status: 400 });
  }

  const techCatalogList = TECH_CATALOG.map((t) => `  ${t.id} (${t.label})`).join('\n');

  const conversation = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const userPrompt = [
    'Conversation so far:',
    conversation,
    '',
    `Current diagram nodes:\n${JSON.stringify(currentNodes, null, 2)}`,
    '',
    `Current connections:\n${JSON.stringify(currentConnections, null, 2)}`,
    '',
    `Available tech ids:\n${techCatalogList}`,
    '',
    'Respond to the latest user message and return the updated full diagram.',
  ].join('\n');

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: RESPONSE_SCHEMA as any,
        temperature: 0.4,
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
      .filter(
        (c) => validIds.has(c.fromNodeId) && validIds.has(c.toNodeId) && c.fromNodeId !== c.toNodeId
      )
      .map((c, i) => ({
        id: String(c.id || `conn_${Date.now()}_${i}`),
        fromNodeId: c.fromNodeId,
        toNodeId: c.toNodeId,
        fromPort: 's' as const,
        toPort: 'n' as const,
        label: sanitizeEdgeLabel(c.label),
      }));

    return NextResponse.json({
      reply: String(parsed.reply || 'Updated.'),
      nodes: outNodes,
      connections: outConns,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 3).map((s: unknown) => String(s))
        : [],
    });
  } catch (err) {
    console.error('Chat error:', err);
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}
