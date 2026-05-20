import { NextRequest, NextResponse } from 'next/server';
// DEMO BYPASS — Clerk auth import kept commented for easy restore.
// import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { safeGenerateObject } from '@/lib/llm/safeGenerate';
import { graphLayout } from '@/lib/graph-layout';
import { autoLayout } from '@/lib/layout';
import { TECH_CATALOG } from '@/lib/tech-catalog';
import { AIGenerationRequest, DiagramNode, DiagramConnection } from '@/lib/types';
import { sanitizeLabel, sanitizeEdgeLabel } from '@/lib/labels';

const responseSchema = z.object({
  title: z.string(),
  nodes: z.array(
    z.object({
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
      fromNodeId: z.string(),
      toNodeId: z.string(),
      label: z.string().optional(),
    })
  ),
  suggestions: z.array(z.string()).optional(),
});

const SYSTEM_PROMPT = `You are a senior software architect. Given a problem statement and tech stack, generate a software architecture diagram as structured JSON.

Rules:
- Generate 6–10 nodes.
- title: max 4 words, descriptive.
- node.label: max 3 words PLAIN TEXT. NO HTML, NO mermaid, NO <br>, NO surrounding quotes, NO literal "\\n".
- node.type: one of service|database|queue|gateway|frontend|cache|auth|monitor|cdn|ml|external.
- node.techId: an id from the provided catalog, or empty string.
- node.x: integer 80-700. node.y: integer 80-560 (will be overridden by graph layout).
- node.desc: one line, max 8 words. Plain text.
- connections: every fromNodeId/toNodeId must equal an existing node.label EXACTLY (case-insensitive).
- connection.label: protocol or data type, max 2 words. NEVER more than 18 characters.
- suggestions: exactly 3 actionable architectural improvements specific to this design, max 15 words each.`;

export async function POST(req: NextRequest) {
  // DEMO BYPASS — original auth check:
  // const { userId } = await auth();
  // if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: AIGenerationRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { problemStatement, techStack = [], orgInstructions } = body;
  if (!problemStatement || problemStatement.trim().length < 10) {
    return NextResponse.json(
      { error: 'Problem statement must be at least 10 characters' },
      { status: 400 }
    );
  }

  const techCatalogList = TECH_CATALOG.map(
    (t) => `  ${t.id} (${t.label}, category: ${t.category})`
  ).join('\n');

  const selectedTechNames = techStack
    .map((id) => TECH_CATALOG.find((t) => t.id === id)?.label)
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
    const { object: parsed } = await safeGenerateObject({
      schema: responseSchema,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.4,
    });

    const validTechIds = new Set(TECH_CATALOG.map((t) => t.id));
    const clamp = (v: number, lo: number, hi: number) =>
      Math.max(lo, Math.min(hi, v));

    const rawNodes: DiagramNode[] = parsed.nodes.map((n, i) => ({
      id: `node_${Date.now()}_${i}`,
      label: sanitizeLabel(n.label) || `Node ${i + 1}`,
      techId: n.techId && validTechIds.has(n.techId) ? n.techId : undefined,
      type: (n.type || 'service') as DiagramNode['type'],
      x: clamp(Number(n.x) || 100, 80, 700),
      y: clamp(Number(n.y) || 100, 60, 560),
      width: 180,
      height: 96,
      desc: String(n.desc || '').slice(0, 80),
    }));

    const labelToId = new Map(rawNodes.map((n) => [n.label.toLowerCase(), n.id]));

    const rawConns: DiagramConnection[] = parsed.connections
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
          label: sanitizeEdgeLabel(c.label ?? ''),
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    const nodes =
      rawConns.length > 0 ? graphLayout(rawNodes, rawConns) : autoLayout(rawNodes);

    return NextResponse.json({
      title: sanitizeLabel(parsed.title) || 'Untitled Architecture',
      nodes,
      connections: rawConns,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 3).map((s) => String(s))
        : [],
    });
  } catch (err) {
    console.error('AI generation error:', err);
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
