import type { Architecture } from '@/lib/architecture/schema';

/**
 * Canonical Architecture → Excalidraw scene JSON. The output is a
 * minimal, importable scene — paste it into excalidraw.com or feed it
 * to the @excalidraw/excalidraw component.
 *
 * Format reference: https://docs.excalidraw.com/docs/codebase/json-schema
 *
 * We don't try to render decisions/NFRs/sequences — the goal is just to
 * get a usable Excalidraw export of the system topology.
 */

type ExcalidrawElement = {
  id: string;
  type: 'rectangle' | 'ellipse' | 'arrow' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  angle: 0;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: 'solid' | 'hachure' | 'none';
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: null;
  roundness: { type: number } | null;
  seed: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: { id: string; type: 'arrow' }[] | null;
  updated: number;
  link: null;
  locked: boolean;
  // type-specific:
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  containerId?: string | null;
  startBinding?: { elementId: string; focus: number; gap: number } | null;
  endBinding?: { elementId: string; focus: number; gap: number } | null;
  startArrowhead?: 'arrow' | null;
  endArrowhead?: 'arrow' | null;
  points?: [number, number][];
};

const NODE_W = 180;
const NODE_H = 80;

export function architectureToExcalidraw(arch: Architecture): {
  type: 'excalidraw';
  version: 2;
  source: 'https://architectai.app';
  elements: ExcalidrawElement[];
  appState: { viewBackgroundColor: string; gridSize: null };
  files: Record<string, never>;
} {
  const elements: ExcalidrawElement[] = [];
  const elementIds = new Map<string, string>(); // canonical id → excalidraw id

  // Box + label for each component / datastore / external.
  const items: { id: string; name: string; x: number; y: number; shape: 'rectangle' | 'ellipse' }[] = [];
  arch.components.forEach((c, i) => {
    items.push({
      id: c.id,
      name: c.name,
      x: c.position?.x ?? 80 + (i % 4) * (NODE_W + 60),
      y: c.position?.y ?? 80 + Math.floor(i / 4) * (NODE_H + 60),
      shape: 'rectangle',
    });
  });
  arch.dataStores.forEach((ds, i) => {
    items.push({
      id: ds.id,
      name: ds.name,
      x: 80 + (i % 4) * (NODE_W + 60),
      y: 600 + Math.floor(i / 4) * (NODE_H + 60),
      shape: 'ellipse',
    });
  });
  arch.externalSystems.forEach((ext, i) => {
    items.push({
      id: ext.id,
      name: ext.name,
      x: 80 + (i % 4) * (NODE_W + 60),
      y: 20,
      shape: 'rectangle',
    });
  });

  for (const item of items) {
    const boxId = exId();
    const textId = exId();
    elementIds.set(item.id, boxId);
    elements.push(box(boxId, textId, item.x, item.y, item.shape));
    elements.push(textBlock(textId, boxId, item.name, item.x, item.y));
  }

  for (const conn of arch.connections) {
    const fromId = elementIds.get(conn.fromComponentId);
    const toId = elementIds.get(conn.toComponentId);
    if (!fromId || !toId) continue;
    elements.push(arrow(exId(), fromId, toId, conn.sync === 'async'));
  }

  return {
    type: 'excalidraw',
    version: 2,
    source: 'https://architectai.app',
    elements,
    appState: { viewBackgroundColor: '#ffffff', gridSize: null },
    files: {},
  };
}

// ─── Element builders ──────────────────────────────────────────────────────

let counter = 1;
function exId(): string {
  return `el_${(counter++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function commonElement(): Pick<
  ExcalidrawElement,
  'angle' | 'strokeColor' | 'backgroundColor' | 'fillStyle' | 'strokeWidth' | 'strokeStyle' | 'roughness' | 'opacity' | 'groupIds' | 'frameId' | 'roundness' | 'seed' | 'versionNonce' | 'isDeleted' | 'boundElements' | 'updated' | 'link' | 'locked'
> {
  return {
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 3 },
    seed: Math.floor(Math.random() * 1e9),
    versionNonce: Math.floor(Math.random() * 1e9),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

function box(
  id: string,
  textId: string,
  x: number,
  y: number,
  shape: 'rectangle' | 'ellipse'
): ExcalidrawElement {
  return {
    ...commonElement(),
    id,
    type: shape,
    x,
    y,
    width: NODE_W,
    height: NODE_H,
    boundElements: [{ id: textId, type: 'arrow' }],
  };
}

function textBlock(
  id: string,
  containerId: string,
  text: string,
  x: number,
  y: number
): ExcalidrawElement {
  return {
    ...commonElement(),
    id,
    type: 'text',
    x: x + 8,
    y: y + 24,
    width: NODE_W - 16,
    height: 32,
    text,
    fontSize: 16,
    fontFamily: 1,
    textAlign: 'center',
    verticalAlign: 'middle',
    containerId,
  };
}

function arrow(
  id: string,
  startId: string,
  endId: string,
  dashed: boolean
): ExcalidrawElement {
  return {
    ...commonElement(),
    id,
    type: 'arrow',
    x: 0,
    y: 0,
    width: 100,
    height: 0,
    strokeStyle: dashed ? 'dashed' : 'solid',
    startBinding: { elementId: startId, focus: 0, gap: 4 },
    endBinding: { elementId: endId, focus: 0, gap: 4 },
    startArrowhead: null,
    endArrowhead: 'arrow',
    points: [
      [0, 0],
      [100, 0],
    ],
  };
}
