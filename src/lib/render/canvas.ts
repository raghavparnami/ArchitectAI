import type { Architecture, Component } from '@/lib/architecture/schema';
import type {
  DiagramConnection,
  DiagramGroup,
  DiagramNode,
  NodeType,
} from '@/lib/types';
import { autoLayout } from '@/lib/layout';

/**
 * Canonical Architecture → existing canvas store payload.
 *
 * The canvas component model is flatter than the canonical model: there
 * are no separate DataStore / ExternalSystem collections. We project all
 * three into a single DiagramNode array, preserving the canonical id so
 * a round-trip through the canvas doesn't lose identity.
 */

const COMPONENT_TYPE_TO_NODE_TYPE: Record<Component['type'], NodeType> = {
  service: 'service',
  gateway: 'gateway',
  queue: 'queue',
  cache: 'cache',
  db: 'database',
  frontend: 'frontend',
  job: 'service',
  external: 'external',
  library: 'service',
  cdn: 'cdn',
  auth: 'auth',
  monitor: 'monitor',
  ml: 'ml',
};

export type CanvasPayload = {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  groups: DiagramGroup[];
  title: string;
  techIds: string[];
};

export function architectureToCanvas(arch: Architecture): CanvasPayload {
  const nodes: DiagramNode[] = [];

  // 1. Components (the bulk of the diagram).
  for (const c of arch.components) {
    nodes.push({
      id: c.id,
      label: c.name,
      type: COMPONENT_TYPE_TO_NODE_TYPE[c.type],
      techId: c.tech ? techIdFromLabel(c.tech) : undefined,
      desc: c.responsibilities[0],
      x: c.position?.x ?? 0,
      y: c.position?.y ?? 0,
      width: c.position?.w ?? 180,
      height: c.position?.h ?? 96,
    });
  }

  // 2. Data stores.
  for (const ds of arch.dataStores) {
    nodes.push({
      id: ds.id,
      label: ds.name,
      type: 'database',
      techId: ds.tech ? techIdFromLabel(ds.tech) : undefined,
      desc: ds.kind,
      x: 0,
      y: 0,
      width: 180,
      height: 96,
    });
  }

  // 3. External systems.
  for (const ext of arch.externalSystems) {
    nodes.push({
      id: ext.id,
      label: ext.name,
      type: 'external',
      desc: ext.vendor,
      x: 0,
      y: 0,
      width: 180,
      height: 96,
    });
  }

  // Auto-layout if any node is at (0,0) — i.e. the LLM didn't supply
  // positions, or this is a fresh import.
  const needsLayout = nodes.some((n) => n.x === 0 && n.y === 0);
  const laid = needsLayout ? autoLayout(nodes) : nodes;

  // 4. Connections.
  const connections: DiagramConnection[] = arch.connections.map((c) => ({
    id: c.id,
    fromNodeId: c.fromComponentId,
    toNodeId: c.toComponentId,
    fromPort: 's',
    toPort: 'n',
    label: c.dataFlow ? truncate(c.dataFlow, 18) : c.protocol,
    style: c.sync === 'async' ? 'dashed' : 'solid',
  }));

  // 5. Groups: future work — derive from external/internal split, k8s
  //    namespaces, VPCs. Empty for now.
  const groups: DiagramGroup[] = [];

  // 6. Aggregate tech ids for the diagram-level techIds set.
  const techIds = Array.from(
    new Set(
      laid
        .map((n) => n.techId)
        .filter((t): t is string => Boolean(t))
    )
  );

  return {
    nodes: laid,
    connections,
    groups,
    title: arch.title,
    techIds,
  };
}

/**
 * Reverse adapter — used when the user edits on the canvas and we want
 * to persist the change back into the canonical model. NOT a full
 * round-trip: details only present in the canonical model (NFRs,
 * decisions, citations, etc.) are preserved by merging on top of the
 * existing arch rather than reconstructing from scratch.
 */
export function applyCanvasToArchitecture(
  arch: Architecture,
  payload: CanvasPayload
): Architecture {
  const nodesById = new Map(payload.nodes.map((n) => [n.id, n]));

  const components = arch.components.map((c) => {
    const node = nodesById.get(c.id);
    if (!node) return c;
    return {
      ...c,
      name: node.label,
      tech: node.techId ?? c.tech,
      position: {
        x: node.x,
        y: node.y,
        w: node.width,
        h: node.height,
      },
    };
  });

  const dataStores = arch.dataStores.map((ds) => {
    const node = nodesById.get(ds.id);
    if (!node) return ds;
    return { ...ds, name: node.label, tech: node.techId ?? ds.tech };
  });

  const externalSystems = arch.externalSystems.map((ext) => {
    const node = nodesById.get(ext.id);
    if (!node) return ext;
    return { ...ext, name: node.label };
  });

  const existingConnIds = new Set(arch.connections.map((c) => c.id));
  const updatedConnections = arch.connections.map((c) => {
    const dc = payload.connections.find((p) => p.id === c.id);
    if (!dc) return c;
    return {
      ...c,
      fromComponentId: dc.fromNodeId,
      toComponentId: dc.toNodeId,
    };
  });
  // Newly drawn connections on the canvas: append with default sync/protocol.
  for (const dc of payload.connections) {
    if (!existingConnIds.has(dc.id)) {
      updatedConnections.push({
        id: dc.id,
        fromComponentId: dc.fromNodeId,
        toComponentId: dc.toNodeId,
        protocol: 'http',
        sync: dc.style === 'dashed' ? 'async' : 'sync',
        dataFlow: dc.label ?? '',
      });
    }
  }

  return {
    ...arch,
    title: payload.title,
    components,
    dataStores,
    externalSystems,
    connections: updatedConnections,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Best-effort lookup of a known tech catalog id from a free-text tech
 * label like "Postgres 16" → "postgres". Falls back to undefined when
 * no match — the canvas will then render without a tech logo.
 *
 * We import the catalog lazily so this module stays usable from server
 * code that doesn't want the full catalog bundle.
 */
function techIdFromLabel(label: string): string | undefined {
  const normalized = label.toLowerCase();
  for (const [keyword, id] of TECH_KEYWORD_MAP) {
    if (normalized.includes(keyword)) return id;
  }
  return undefined;
}

// Curated subset of the tech catalog (see lib/tech-catalog.ts) to keep
// the renderer dependency-free. Add to this list when the LLM keeps
// returning a tech that we have a logo for but isn't matching here.
const TECH_KEYWORD_MAP: ReadonlyArray<readonly [string, string]> = [
  ['postgres', 'postgres'],
  ['mysql', 'mysql'],
  ['mongodb', 'mongodb'],
  ['redis', 'redis'],
  ['kafka', 'kafka'],
  ['rabbit', 'rabbitmq'],
  ['s3', 'aws-s3'],
  ['lambda', 'aws-lambda'],
  ['cloudfront', 'aws-cloudfront'],
  ['nginx', 'nginx'],
  ['node', 'nodejs'],
  ['next', 'nextjs'],
  ['react', 'react'],
  ['vue', 'vue'],
  ['python', 'python'],
  ['fastapi', 'fastapi'],
  ['django', 'django'],
  ['kubernetes', 'kubernetes'],
  ['docker', 'docker'],
  ['terraform', 'terraform'],
  ['stripe', 'stripe'],
  ['supabase', 'supabase'],
  ['vercel', 'vercel'],
  ['cloudflare', 'cloudflare'],
] as const;
