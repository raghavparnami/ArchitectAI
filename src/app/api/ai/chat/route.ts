import { NextRequest, NextResponse } from 'next/server';
// DEMO BYPASS — Clerk auth import kept commented for easy restore.
// import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { safeGenerateObject } from '@/lib/llm/safeGenerate';
import { graphLayout } from '@/lib/graph-layout';
import { TECH_CATALOG } from '@/lib/tech-catalog';
import { ChatMessage, DiagramConnection, DiagramNode } from '@/lib/types';
import { sanitizeLabel, sanitizeEdgeLabel } from '@/lib/labels';

const responseSchema = z.object({
  reply: z.string(),
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
  // Review mode — populated only when mode='review'. Empty for 'design'.
  critique: z
    .array(
      z.object({
        severity: z.enum(['info', 'warn', 'risk']),
        area: z.string(),
        finding: z.string(),
        suggestion: z.string(),
      })
    )
    .optional(),
});

const DESIGN_SYSTEM_PROMPT = `You are a senior software architect helping a user iteratively design a system architecture through conversation.

Given the conversation history and the current diagram state, respond to the user's latest message.
Each turn you MUST return:
- reply: a short conversational response (1-2 sentences) acknowledging what you did
- nodes: the FULL updated nodes array (preserve existing IDs; mint new ones for additions)
- connections: the FULL updated connections array (using the same node IDs)
- suggestions: 3 follow-up actions the user could ask for next
- critique: leave empty in design mode

Rules:
- Preserve existing node IDs when a node is unchanged
- New IDs follow the pattern node_xxx / conn_xxx
- node.x: integer 80-700. node.y: integer 80-560.
- Layer top-to-bottom: Frontend (y≈80-140), API/Gateway (y≈220-280), Services (y≈360-440), Data (y≈500-560)
- node.label: PLAIN TEXT, max 3 words. NO HTML, NO mermaid markup, NO <br>, NO surrounding quotes, NO literal "\\n", NO backticks. If you need two words use a single space — never a line break.
- node.desc: PLAIN TEXT, ≤ 8 words. Same no-HTML / no-quote rules as label.
- node.type: service|database|queue|gateway|frontend|cache|auth|monitor|cdn|ml|external
- node.techId: id from catalog or empty string
- connection endpoints must reference existing node ids
- connection.label: max 18 chars, PLAIN TEXT only. Examples: "HTTP", "Events", "SQL". NO HTML, NO <br>.
- Be specific in your reply — say what you added, removed, or changed`;

const REVIEW_SYSTEM_PROMPT = `You are a senior software architect performing a critical review of an existing architecture diagram against a problem statement.

You will receive: a problem statement, the user's conversation, the current diagram (nodes + connections).
Your job is to evaluate how well the current design addresses the problem statement and to surface concrete issues.

Each turn you MUST return:
- reply: 2-3 sentence executive verdict (does the design solve the problem? what is the biggest gap?)
- nodes: return the diagram nodes UNCHANGED unless a critique change is so obvious you want to suggest a node addition — in that case mint a new node with a clear label
- connections: return the connections UNCHANGED unless suggesting a new one
- suggestions: 3 specific follow-up asks (e.g. "show how the cache invalidates", "add a DLQ", "swap MySQL for Postgres because…")
- critique: 3-7 critique items. Each item:
    severity: "info" | "warn" | "risk"
    area: one of "scalability", "reliability", "security", "data", "cost", "complexity", "fit-to-problem"
    finding: what is wrong or missing (1 sentence, specific to THIS design)
    suggestion: concrete remediation (1 sentence, actionable)

Be specific and opinionated. Do NOT produce vague critique. Reference component IDs/labels from the diagram in your findings.`;

interface ChatBody {
  messages: ChatMessage[];
  currentNodes: DiagramNode[];
  currentConnections: DiagramConnection[];
  mode?: 'design' | 'review';
  problemStatement?: string;
}

export async function POST(req: NextRequest) {
  // DEMO BYPASS — original auth check:
  // const { userId } = await auth();
  // if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    messages,
    currentNodes,
    currentConnections,
    mode = 'design',
    problemStatement,
  } = body;
  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'Messages required' }, { status: 400 });
  }

  const techCatalogList = TECH_CATALOG.map((t) => `  ${t.id} (${t.label})`).join('\n');

  const conversation = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const userPrompt = [
    mode === 'review' && problemStatement
      ? `Problem statement (what this system is supposed to solve):\n${problemStatement}\n`
      : '',
    'Conversation so far:',
    conversation,
    '',
    `Current diagram nodes:\n${JSON.stringify(currentNodes, null, 2)}`,
    '',
    `Current connections:\n${JSON.stringify(currentConnections, null, 2)}`,
    '',
    `Available tech ids:\n${techCatalogList}`,
    '',
    mode === 'review'
      ? 'Critically review the current diagram against the problem statement. Return critique items + verdict in reply.'
      : 'Respond to the latest user message and return the updated full diagram.',
  ]
    .filter(Boolean)
    .join('\n');

  const systemPrompt =
    mode === 'review' ? REVIEW_SYSTEM_PROMPT : DESIGN_SYSTEM_PROMPT;

  try {
    const { object: parsed } = await safeGenerateObject({
      schema: responseSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.4,
    });
    const validTechIds = new Set(TECH_CATALOG.map((t) => t.id));
    const clamp = (v: number, lo: number, hi: number) =>
      Math.max(lo, Math.min(hi, v));

    const outNodes: DiagramNode[] = parsed.nodes.map((n, i) => ({
      id: String(n.id || `node_${Date.now()}_${i}`),
      label: sanitizeLabel(n.label) || 'Node',
      techId:
        n.techId && validTechIds.has(n.techId) ? n.techId : undefined,
      type: (n.type || 'service') as DiagramNode['type'],
      x: clamp(Number(n.x) || 100, 80, 700),
      y: clamp(Number(n.y) || 100, 60, 560),
      width: 180,
      height: 96,
      desc: String(n.desc || '').slice(0, 80),
    }));

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

    // Lay the diagram out hierarchically (top → bottom DAG) when there are
    // edges to follow. Without graph-aware layout, LLM-suggested positions
    // produce tangled bezier curves crossing nodes. Review mode never
    // re-layouts — the user is inspecting an existing design.
    const finalNodes =
      mode === 'review' || outConns.length === 0
        ? outNodes
        : graphLayout(outNodes, outConns);

    return NextResponse.json({
      reply: String(parsed.reply || (mode === 'review' ? 'Reviewed.' : 'Updated.')),
      nodes: finalNodes,
      connections: outConns,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 3).map((s) => String(s))
        : [],
      critique: Array.isArray(parsed.critique) ? parsed.critique : [],
      mode,
    });
  } catch (err) {
    console.error('Chat error:', err);
    const message = err instanceof Error ? err.message : 'Chat failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
