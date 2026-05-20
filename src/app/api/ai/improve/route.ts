import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { safeGenerateObject } from '@/lib/llm/safeGenerate';
import { TECH_CATALOG } from '@/lib/tech-catalog';
import { DiagramConnection, DiagramNode } from '@/lib/types';
import { sanitizeLabel, sanitizeEdgeLabel } from '@/lib/labels';

const improveSchema = z.object({
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
  changeSummary: z.string(),
});

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
  // DEMO BYPASS — original auth check:
  // const { userId } = await auth();
  // if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const { object: parsed } = await safeGenerateObject({
      schema: improveSchema,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.3,
    });

    const validTechIds = new Set(TECH_CATALOG.map((t) => t.id));
    const clamp = (v: number, lo: number, hi: number) =>
      Math.max(lo, Math.min(hi, v));

    // Preserve user's existing layout: pin x/y of any node whose id matches a
    // pre-existing one. The LLM often re-flows the whole canvas even when we
    // tell it not to — this enforces the contract deterministically.
    const originalById = new Map(nodes.map((n) => [n.id, n]));

    const outNodes: DiagramNode[] = parsed.nodes.map((n, i) => {
      const orig = n.id ? originalById.get(n.id) : undefined;
      const id = String(n.id || `node_${Date.now()}_${i}`);
      return {
        id,
        label: sanitizeLabel(n.label) || 'Node',
        techId: n.techId && validTechIds.has(n.techId) ? n.techId : undefined,
        type: (n.type || 'service') as DiagramNode['type'],
        // Existing node → keep its original x/y/width/height untouched.
        // New node → use whatever the LLM proposed, clamped to canvas bounds.
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
      changeSummary: String(parsed.changeSummary || ''),
    });
  } catch (err) {
    console.error('Improve error:', err);
    const message = err instanceof Error ? err.message : 'Improve failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
