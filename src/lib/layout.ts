import { DiagramNode, NodeType } from './types';

/**
 * Lay nodes out in horizontal bands by type so AI-generated and imported
 * diagrams come back with consistent spacing + box sizing.
 *
 * Layout rules:
 * - Every node gets the same width/height so labels render predictably.
 * - 4 horizontal bands by type (frontend → gateway → service → data).
 * - Each band's row is centered around `CANVAS_CENTER_X`, so the diagram
 *   sits in the middle of the canvas regardless of how many nodes are in it.
 * - If a band has more nodes than `MAX_PER_ROW`, it wraps to a second row
 *   inside the band (still centered) instead of stretching off-canvas.
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

// All nodes get these dimensions — keeps spacing math simple and the diagram
// visually consistent (no tiny boxes next to giant ones).
const NODE_W = 180;
const NODE_H = 92;

// Horizontal gap between node centers within a row.
const COL_PITCH = 220;
// Vertical gap between row centers (a single band might have multiple rows).
const ROW_PITCH = 140;
// Top of band 0. Subsequent bands start `BAND_GAP` below the previous band.
const BAND_TOP_Y = 90;
const BAND_GAP = 60; // extra gap between bands beyond ROW_PITCH
const CANVAS_CENTER_X = 480;
const MARGIN_X = 80;
const MAX_PER_ROW = 5;

export function autoLayout(nodes: DiagramNode[]): DiagramNode[] {
  if (nodes.length === 0) return nodes;

  // Group by band, preserve original order within each band.
  const bands: Record<number, DiagramNode[]> = { 0: [], 1: [], 2: [], 3: [] };
  nodes.forEach((n) => {
    const band = TYPE_BAND[n.type] ?? 2;
    bands[band].push(n);
  });

  const result: DiagramNode[] = [];
  let yCursor = BAND_TOP_Y;

  for (const bandStr of Object.keys(bands)) {
    const list = bands[Number(bandStr)];
    if (list.length === 0) continue;

    // Split into rows of at most MAX_PER_ROW so a 12-service band doesn't
    // run off the right edge.
    const rows: DiagramNode[][] = [];
    for (let i = 0; i < list.length; i += MAX_PER_ROW) {
      rows.push(list.slice(i, i + MAX_PER_ROW));
    }

    rows.forEach((row, rIdx) => {
      const rowY = yCursor + rIdx * ROW_PITCH;
      // Center the row horizontally around CANVAS_CENTER_X, but never let
      // the first column go past the left margin — long bands stay anchored
      // at x=MARGIN_X and just extend to the right instead of clipping off
      // the left edge of the canvas.
      const totalSpan = (row.length - 1) * COL_PITCH;
      const centeredStart = CANVAS_CENTER_X - totalSpan / 2 - NODE_W / 2;
      const startX = Math.max(MARGIN_X, centeredStart);
      row.forEach((n, cIdx) => {
        result.push({
          ...n,
          x: Math.round(startX + cIdx * COL_PITCH),
          y: Math.round(rowY),
          width: NODE_W,
          height: NODE_H,
        });
      });
    });

    // Advance the y-cursor past this band (rows * pitch + band gap).
    yCursor += rows.length * ROW_PITCH + BAND_GAP;
  }

  return result;
}
