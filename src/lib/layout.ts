import { DiagramNode, NodeType } from './types';

/**
 * Lay nodes out in horizontal bands by type so AI-generated diagrams don't
 * end up in a chaotic mess. Frontend at top, gateways below, services in the
 * middle, data at the bottom.
 */
const TYPE_BAND: Record<NodeType, number> = {
  frontend: 0,
  cdn:      0,
  external: 0,
  gateway:  1,
  auth:     1,
  service:  2,
  cache:    2,
  queue:    2,
  ml:       2,
  monitor:  2,
  shape:    2,
  database: 3,
  entity:   3,
};

const ROW_Y = [80, 240, 400, 560];
const ROW_GAP = 200;
const COL_GAP = 220;
const START_X = 80;

export function autoLayout(nodes: DiagramNode[]): DiagramNode[] {
  if (nodes.length === 0) return nodes;

  // Group by band, preserve original order within each band
  const bands: Record<number, DiagramNode[]> = { 0: [], 1: [], 2: [], 3: [] };
  nodes.forEach((n) => {
    const band = TYPE_BAND[n.type] ?? 2;
    bands[band].push(n);
  });

  const result: DiagramNode[] = [];
  Object.entries(bands).forEach(([bandStr, list]) => {
    if (list.length === 0) return;
    const band = Number(bandStr);
    const y = ROW_Y[band] ?? band * ROW_GAP;
    list.forEach((n, i) => {
      result.push({
        ...n,
        x: START_X + i * COL_GAP,
        y,
      });
    });
  });

  return result;
}
