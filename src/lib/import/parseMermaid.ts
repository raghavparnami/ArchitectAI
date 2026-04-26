import { DiagramNode, DiagramConnection, NodeType } from '@/lib/types';

/**
 * Minimal Mermaid parser for `flowchart` / `graph` and `erDiagram`.
 * Not a full parser — just enough to handle the common patterns.
 */
export function parseMermaid(source: string): {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
} {
  const trimmed = source.trim();
  if (/^erDiagram/i.test(trimmed)) return parseErDiagram(trimmed);
  return parseFlowchart(trimmed);
}

// ─── Flowchart parser ─────────────────────────────────────────────────────

function parseFlowchart(source: string): {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
} {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('%%'));

  const nodes = new Map<string, DiagramNode>();
  const connections: DiagramConnection[] = [];

  // Strip the `flowchart LR` / `graph TD` header
  const body = lines.filter((l) => !/^(flowchart|graph)\b/i.test(l));

  // Edge regex: A[Label] -->|edge label| B(Other)
  // Capture: source-id, optional shape+label, arrow, optional |edge label|, target-id, optional shape+label
  const edgeRe =
    /([A-Za-z0-9_-]+)\s*(\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|\(\([^)]*\)\)|>\[[^\]]*\])?\s*(-->|---|-\.->|==>)\s*(?:\|([^|]*)\|)?\s*([A-Za-z0-9_-]+)\s*(\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|\(\([^)]*\)\)|>\[[^\]]*\])?/;

  // Standalone node declaration: A[Label]
  const declRe = /^([A-Za-z0-9_-]+)\s*(\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|\(\([^)]*\)\)|>\[[^\]]*\])$/;

  let idx = 0;
  const ensureNode = (
    rawId: string,
    rawShape: string | undefined
  ): DiagramNode => {
    if (nodes.has(rawId)) return nodes.get(rawId)!;
    const { label, type, shape } = parseNodeShape(rawShape, rawId);
    const node: DiagramNode = {
      id: `node_${Date.now()}_${idx}`,
      label,
      type,
      shape,
      x: 100 + (idx % 4) * 180,
      y: 100 + Math.floor(idx / 4) * 140,
      width: 140,
      height: 80,
    };
    idx += 1;
    nodes.set(rawId, node);
    return node;
  };

  for (const line of body) {
    const decl = line.match(declRe);
    if (decl) {
      ensureNode(decl[1], decl[2]);
      continue;
    }
    let m;
    let rest = line;
    // Allow chained edges like A --> B --> C by walking the line
    while ((m = rest.match(edgeRe))) {
      const [match, fromId, fromShape, , edgeLabel, toId, toShape] = m;
      const from = ensureNode(fromId, fromShape);
      const to = ensureNode(toId, toShape);
      connections.push({
        id: `conn_${Date.now()}_${connections.length}`,
        fromNodeId: from.id,
        toNodeId: to.id,
        fromPort: 's',
        toPort: 'n',
        label: edgeLabel?.trim() || undefined,
      });
      rest = rest.slice(rest.indexOf(match) + match.length);
    }
  }

  return { nodes: Array.from(nodes.values()), connections };
}

function parseNodeShape(rawShape: string | undefined, rawId: string) {
  if (!rawShape) {
    return { label: rawId, type: 'service' as NodeType, shape: 'rect' as const };
  }
  const inner = rawShape.replace(/^\(\(|^[\[\(\{>]|[\]\)\}]$|\)\)$/g, '').trim();
  const label = inner || rawId;
  if (rawShape.startsWith('[(') || rawShape.startsWith('(['))
    return { label, type: 'database' as NodeType, shape: 'cylinder' as const };
  if (rawShape.startsWith('('))
    return { label, type: 'service' as NodeType, shape: 'ellipse' as const };
  if (rawShape.startsWith('{'))
    return { label, type: 'gateway' as NodeType, shape: 'diamond' as const };
  if (rawShape.startsWith('(('))
    return { label, type: 'service' as NodeType, shape: 'circle' as const };
  return { label, type: 'service' as NodeType, shape: 'rect' as const };
}

// ─── ER diagram parser ────────────────────────────────────────────────────

function parseErDiagram(source: string): {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
} {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^erDiagram/i.test(l));

  const entities = new Map<string, DiagramNode>();
  const connections: DiagramConnection[] = [];
  let idx = 0;

  const ensureEntity = (name: string): DiagramNode => {
    if (entities.has(name)) return entities.get(name)!;
    const node: DiagramNode = {
      id: `node_${Date.now()}_${idx}`,
      label: name,
      type: 'entity',
      shape: 'rect',
      x: 100 + (idx % 3) * 220,
      y: 100 + Math.floor(idx / 3) * 200,
      width: 180,
      height: 100,
      fields: [],
    };
    idx += 1;
    entities.set(name, node);
    return node;
  };

  // Relationship: ENTITY1 ||--o{ ENTITY2 : "label"
  const relRe = /^([A-Za-z0-9_]+)\s*([|}o\-{]+)\s*([A-Za-z0-9_]+)\s*:?\s*"?([^"]*)"?$/;

  // Block start: ENTITY1 {  ... }
  let inEntityBlock: string | null = null;
  for (const line of lines) {
    if (inEntityBlock) {
      if (line === '}') {
        inEntityBlock = null;
        continue;
      }
      // Field: type name PK / FK
      const m = line.match(/^([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)(?:\s+(PK|FK))?/);
      if (m) {
        const node = ensureEntity(inEntityBlock);
        node.fields!.push({
          name: m[2],
          type: m[1],
          pk: m[3] === 'PK',
          fk: m[3] === 'FK',
        });
      }
      continue;
    }
    const blockStart = line.match(/^([A-Za-z0-9_]+)\s*\{$/);
    if (blockStart) {
      inEntityBlock = blockStart[1];
      ensureEntity(blockStart[1]);
      continue;
    }
    const rel = line.match(relRe);
    if (rel) {
      const a = ensureEntity(rel[1]);
      const b = ensureEntity(rel[3]);
      connections.push({
        id: `conn_${Date.now()}_${connections.length}`,
        fromNodeId: a.id,
        toNodeId: b.id,
        fromPort: 'e',
        toPort: 'w',
        label: rel[4]?.trim() || undefined,
      });
    }
  }

  return { nodes: Array.from(entities.values()), connections };
}
