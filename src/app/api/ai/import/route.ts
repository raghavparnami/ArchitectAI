import { NextRequest, NextResponse } from 'next/server';
// DEMO BYPASS — Clerk auth import kept commented for easy restore.
// import { auth } from '@clerk/nextjs/server';
import { parseMermaid } from '@/lib/import/parseMermaid';
import { parseDrawioXml } from '@/lib/import/parseDrawioXml';
import { DiagramConnection, DiagramNode, ImportSource } from '@/lib/types';
import { sanitizeLabel } from '@/lib/labels';
import { autoLayout } from '@/lib/layout';
import { graphLayout } from '@/lib/graph-layout';

interface ImportBody {
  source: ImportSource;
  payload: string; // raw text — image source is disabled.
}

export async function POST(req: NextRequest) {
  // DEMO BYPASS — original auth check:
  // const { userId } = await auth();
  // if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: ImportBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { source, payload } = body;
  if (!payload) {
    return NextResponse.json({ error: 'Empty payload' }, { status: 400 });
  }

  try {
    // XML / Mermaid / JSON go through local parsers — no LLM call required.
    if (source === 'xml') {
      const { nodes, connections } = parseDrawioXml(payload);
      const stamped = stamp(nodes);
      const stampedConns = stamp(connections, 'conn') as DiagramConnection[];
      const laidOut =
        stampedConns.length > 0
          ? graphLayout(stamped, stampedConns)
          : autoLayout(stamped);
      return NextResponse.json({
        title: 'Imported diagram',
        nodes: laidOut,
        connections: stampedConns,
        suggestions: [],
        sourceDetected: 'xml',
      });
    }
    if (source === 'mermaid') {
      const { nodes, connections } = parseMermaid(payload);
      const stamped = stamp(nodes);
      const stampedConns = stamp(connections, 'conn') as DiagramConnection[];
      const laidOut =
        stampedConns.length > 0
          ? graphLayout(stamped, stampedConns)
          : autoLayout(stamped);
      return NextResponse.json({
        title: 'Imported diagram',
        nodes: laidOut,
        connections: stampedConns,
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
        const stampedConns = stamp(connections, 'conn') as DiagramConnection[];
        const laidOut =
          stampedConns.length > 0
            ? graphLayout(stamped, stampedConns)
            : autoLayout(stamped);
        return NextResponse.json({
          title: parsed.title ?? 'Imported diagram',
          nodes: laidOut,
          connections: stampedConns,
          suggestions: [],
          sourceDetected: 'json',
        });
      } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
      }
    }

    // Image source is disabled — DeepSeek via OpenRouter is text-only and we
    // don't ship a vision provider.
    if (source === 'image') {
      return NextResponse.json(
        {
          error:
            'Image import is disabled in this build (DeepSeek is text-only). Paste the diagram as Mermaid, draw.io XML, or JSON instead.',
        },
        { status: 501 }
      );
    }

    return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}

function stamp<T extends { id?: string; label?: string }>(
  arr: T[],
  prefix = 'node'
): T[] {
  return arr.map((item, i) => ({
    ...item,
    id: item.id ?? `${prefix}_${Date.now()}_${i}`,
    label: prefix === 'node' && item.label ? sanitizeLabel(item.label) : item.label,
  }));
}
