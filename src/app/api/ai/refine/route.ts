import { NextRequest, NextResponse } from 'next/server';
// DEMO BYPASS — Clerk auth import kept commented for easy restore.
// import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { safeGenerateObject } from '@/lib/llm/safeGenerate';
import { TECH_CATALOG } from '@/lib/tech-catalog';
import { DiagramNode, DiagramConnection } from '@/lib/types';
import { sanitizeLabel, sanitizeEdgeLabel } from '@/lib/labels';

const refineSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      techId: z.string().optional(),
      type: z.string(),
      x: z.number(),
      y: z.number(),
      desc: z.string().optional(),
    })
  ),
  connections: z.array(
    z.object({
      id: z.string(),
      fromNodeId: z.string(),
      toNodeId: z.string(),
      label: z.string().optional(),
    })
  ),
  suggestions: z.array(z.string()).optional(),
  explanation: z.string().optional(),
});

const SYSTEM_PROMPT = `You are a senior software architect refining an existing architecture diagram.

You receive the current diagram (nodes + connections) and a refinement instruction from the user.
Apply the instruction and return the FULL updated diagram as JSON.

Rules:
- Preserve existing node IDs whenever a node is unchanged or only modified.
- Generate fresh ids ("node_XYZ", "conn_XYZ") for newly added nodes/connections.
- node.x: integer 80-700. node.y: integer 80-560.
- node.label: PLAIN TEXT, max 3 words. NO HTML, NO mermaid markup, NO <br>, NO surrounding quotes, NO literal "\\n".
- node.type: one of service|database|queue|gateway|frontend|cache|auth|monitor|cdn|ml|external.
- node.techId: an id from the provided catalog, or empty string.
- connection.fromNodeId/toNodeId must reference an existing node id from the returned nodes array.
- connection.label: protocol or data type, max 2 words. NEVER more than 18 characters.
- suggestions: 3 NEW suggestions reflecting the refined architecture.
- explanation: 1-2 sentence summary of what you changed.`;

interface RefineBody {
  instruction: string;
  nodes: DiagramNode[];
  connections: DiagramConnection[];
}

export async function POST(req: NextRequest) {
  // DEMO BYPASS — original auth check:
  // const { userId } = await auth();
  // if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: RefineBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { instruction, nodes = [], connections = [] } = body;
  if (!instruction || instruction.trim().length < 3) {
    return NextResponse.json({ error: 'Instruction required' }, { status: 400 });
  }

  const techCatalogList = TECH_CATALOG.map((t) => `  ${t.id} (${t.label})`).join('\n');

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
    const { object: parsed } = await safeGenerateObject({
      schema: refineSchema,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.3,
    });

    const validTechIds = new Set(TECH_CATALOG.map((t) => t.id));
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    const originalById = new Map(nodes.map((n) => [n.id, n]));

    const outNodes: DiagramNode[] = parsed.nodes.map((n, i) => {
      const orig = n.id ? originalById.get(n.id) : undefined;
      const id = String(n.id || `node_${Date.now()}_${i}`);
      return {
        id,
        label: sanitizeLabel(n.label) || 'Node',
        techId: n.techId && validTechIds.has(n.techId) ? n.techId : undefined,
        type: (n.type || 'service') as DiagramNode['type'],
        x: orig ? orig.x : clamp(Number(n.x) || 100, 80, 700),
        y: orig ? orig.y : clamp(Number(n.y) || 100, 60, 560),
        width: orig?.width ?? 180,
        height: orig?.height ?? 96,
        desc: String(n.desc || '').slice(0, 80),
      };
    });

    const validIds = new Set(outNodes.map((n) => n.id));
    const outConns: DiagramConnection[] = parsed.connections
      .filter(
        (c) =>
          validIds.has(c.fromNodeId) &&
          validIds.has(c.toNodeId) &&
          c.fromNodeId !== c.toNodeId
      )
      .map((c, i) => ({
        id: String(c.id || `conn_${Date.now()}_${i}`),
        fromNodeId: c.fromNodeId,
        toNodeId: c.toNodeId,
        fromPort: 's' as const,
        toPort: 'n' as const,
        label: sanitizeEdgeLabel(c.label ?? ''),
      }));

    return NextResponse.json({
      nodes: outNodes,
      connections: outConns,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 3).map((s) => String(s))
        : [],
      explanation: String(parsed.explanation || ''),
    });
  } catch (err) {
    console.error('Refine error:', err);
    const message = err instanceof Error ? err.message : 'Refinement failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
