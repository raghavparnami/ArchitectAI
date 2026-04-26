import { XMLParser } from 'fast-xml-parser';
import { DiagramNode, DiagramConnection, NodeType } from '@/lib/types';

interface MxCell {
  '@_id': string;
  '@_value'?: string;
  '@_style'?: string;
  '@_vertex'?: string;
  '@_edge'?: string;
  '@_source'?: string;
  '@_target'?: string;
  '@_parent'?: string;
  mxGeometry?: {
    '@_x'?: string;
    '@_y'?: string;
    '@_width'?: string;
    '@_height'?: string;
  };
}

/**
 * Parse a draw.io / diagrams.net XML export into our node/connection format.
 * Supports the most common mxCell vertex/edge dialect.
 */
export function parseDrawioXml(xml: string): {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
} {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  let parsed;
  try {
    parsed = parser.parse(xml);
  } catch {
    return { nodes: [], connections: [] };
  }

  // Walk down to mxCell array — handles both compressed and decompressed shapes
  const root =
    parsed?.mxfile?.diagram?.mxGraphModel?.root ??
    parsed?.mxGraphModel?.root ??
    parsed?.root;
  if (!root) return { nodes: [], connections: [] };

  const cellsRaw = root.mxCell;
  const cells: MxCell[] = Array.isArray(cellsRaw) ? cellsRaw : cellsRaw ? [cellsRaw] : [];

  const nodes: DiagramNode[] = [];
  const idMap = new Map<string, string>(); // drawio id → our id

  for (const c of cells) {
    if (c['@_vertex'] !== '1') continue;
    const ourId = `node_${Date.now()}_${nodes.length}`;
    idMap.set(c['@_id'], ourId);
    const geo = c.mxGeometry;
    const label = stripHtml(c['@_value'] ?? '') || `Node ${nodes.length + 1}`;
    const style = c['@_style'] ?? '';
    nodes.push({
      id: ourId,
      label,
      type: typeFromStyle(style),
      shape: shapeFromStyle(style),
      x: Number(geo?.['@_x'] ?? 100 + nodes.length * 30),
      y: Number(geo?.['@_y'] ?? 100 + nodes.length * 30),
      width: Number(geo?.['@_width'] ?? 140),
      height: Number(geo?.['@_height'] ?? 80),
    });
  }

  const connections: DiagramConnection[] = [];
  for (const c of cells) {
    if (c['@_edge'] !== '1') continue;
    const fromOur = c['@_source'] && idMap.get(c['@_source']);
    const toOur = c['@_target'] && idMap.get(c['@_target']);
    if (!fromOur || !toOur || fromOur === toOur) continue;
    connections.push({
      id: `conn_${Date.now()}_${connections.length}`,
      fromNodeId: fromOur,
      toNodeId: toOur,
      fromPort: 's',
      toPort: 'n',
      label: stripHtml(c['@_value'] ?? '') || undefined,
    });
  }

  return { nodes, connections };
}

function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
    .slice(0, 60);
}

function typeFromStyle(style: string): NodeType {
  const s = style.toLowerCase();
  if (s.includes('cylinder') || s.includes('database')) return 'database';
  if (s.includes('rhombus') || s.includes('decision')) return 'gateway';
  if (s.includes('ellipse') || s.includes('actor')) return 'external';
  if (s.includes('cloud')) return 'cdn';
  return 'service';
}

function shapeFromStyle(style: string) {
  const s = style.toLowerCase();
  if (s.includes('cylinder')) return 'cylinder' as const;
  if (s.includes('rhombus')) return 'diamond' as const;
  if (s.includes('ellipse')) return 'ellipse' as const;
  if (s.includes('hexagon')) return 'hexagon' as const;
  if (s.includes('cloud')) return 'cloud' as const;
  if (s.includes('triangle')) return 'triangle' as const;
  return 'rect' as const;
}
