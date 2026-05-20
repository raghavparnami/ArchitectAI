import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
// DEMO BYPASS — Clerk auth import kept commented for easy restore.
// import { auth } from '@clerk/nextjs/server';
import { TECH_CATALOG } from '@/lib/tech-catalog';
import { parseMermaid } from '@/lib/import/parseMermaid';
import { parseDrawioXml } from '@/lib/import/parseDrawioXml';
import { DiagramConnection, DiagramNode, ImportSource } from '@/lib/types';
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
        required: ['label', 'type', 'x', 'y'],
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
        required: ['fromNodeId', 'toNodeId'],
      },
    },
    suggestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['title', 'nodes', 'connections'],
};

const VISION_SYSTEM_PROMPT = `You are extracting a software architecture diagram from an image.

Examine the image and produce structured JSON describing the architecture you see.

Rules:
- Generate 4-12 nodes matching what's visible in the image
- node.label: max 3 words, plain text. NO surrounding quotes. NO literal "\\n" — if a service name has two parts, use a single space
- node.type: one of service|database|queue|gateway|frontend|cache|auth|monitor|cdn|ml|external
- node.techId: if a logo or label clearly identifies a technology from the catalog, use its id; else empty string
- node.x: integer 80-700. node.y: integer 80-560.
- Layer the architecture top-to-bottom: Frontend top, API/Gateway middle, Services/Data bottom
- connections: every fromNodeId/toNodeId must reference an existing node label
- connection.label: protocol or data type, max 2 words. NEVER more than 18 characters.
- title: max 4 words describing what the system does
- suggestions: 3 things that could be improved about the imported architecture`;

interface ImportBody {
  source: ImportSource;
  payload: string; // base64 for image, raw text otherwise
  mimeType?: string;
}

export async function POST(req: NextRequest) {
  // DEMO BYPASS — original auth check:
  // const { userId } = await auth();
  // if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Mermaid / XML / JSON imports parse locally and don't need an LLM key.
  // Only image imports below call Gemini Vision (no DeepSeek equivalent yet).

  let body: ImportBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { source, payload, mimeType } = body;
  if (!payload) {
    return NextResponse.json({ error: 'Empty payload' }, { status: 400 });
  }

  try {
    // ─── XML / Mermaid / JSON go through local parsers (no AI cost) ─────
    if (source === 'xml') {
      const { nodes, connections } = parseDrawioXml(payload);
      const stamped = stamp(nodes);
      return NextResponse.json({
        title: 'Imported diagram',
        nodes: autoLayout(stamped),
        connections: stamp(connections, 'conn'),
        suggestions: [],
        sourceDetected: 'xml',
      });
    }
    if (source === 'mermaid') {
      const { nodes, connections } = parseMermaid(payload);
      const stamped = stamp(nodes);
      return NextResponse.json({
        title: 'Imported diagram',
        nodes: autoLayout(stamped),
        connections: stamp(connections, 'conn'),
        suggestions: [],
        sourceDetected: 'mermaid',
      });
    }
    if (source === 'json') {
      try {
        const parsed = JSON.parse(payload);
        const nodes: DiagramNode[] = Array.isArray(parsed.nodes) ? parsed.nodes : [];
        const connections: DiagramConnection[] = Array.isArray(parsed.connections)
          ? parsed.connections
          : [];
        const stamped = stamp(nodes);
        return NextResponse.json({
          title: parsed.title ?? 'Imported diagram',
          nodes: autoLayout(stamped),
          connections: stamp(connections, 'conn'),
          suggestions: [],
          sourceDetected: 'json',
        });
      } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
      }
    }

    // ─── Image → Gemini Vision ──────────────────────────────────────────
    if (source === 'image') {
      const techCatalogList = TECH_CATALOG.map((t) => `  ${t.id} (${t.label})`).join('\n');
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-pro',
        systemInstruction: VISION_SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: 'application/json',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          responseSchema: RESPONSE_SCHEMA as any,
          temperature: 0.3,
        },
      });

      const result = await model.generateContent([
        { text: `Available tech catalog ids:\n${techCatalogList}\n\nExtract the architecture from this image:` },
        {
          inlineData: {
            mimeType: mimeType ?? 'image/png',
            data: payload, // base64 (no data: prefix)
          },
        },
      ]);

      const parsed = JSON.parse(result.response.text());
      return NextResponse.json(postProcessAiResult(parsed, 'image'));
    }

    return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}

function stamp<T extends { id?: string; label?: string }>(arr: T[], prefix = 'node'): T[] {
  return arr.map((item, i) => ({
    ...item,
    id: item.id ?? `${prefix}_${Date.now()}_${i}`,
    label: prefix === 'node' && item.label ? sanitizeLabel(item.label) : item.label,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function postProcessAiResult(parsed: any, source: ImportSource) {
  const validTechIds = new Set(TECH_CATALOG.map((t) => t.id));
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawNodes: DiagramNode[] = (parsed.nodes as any[]).map((n, i) => ({
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

  const labelToId = new Map(nodes.map((n) => [n.label.toLowerCase(), n.id]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connections: DiagramConnection[] = (parsed.connections as any[])
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

  return {
    title: sanitizeLabel(parsed.title) || 'Imported diagram',
    nodes,
    connections,
    suggestions: Array.isArray(parsed.suggestions)
      ? parsed.suggestions.slice(0, 3).map((s: unknown) => String(s))
      : [],
    sourceDetected: source,
  };
}
