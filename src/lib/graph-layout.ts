import { DiagramNode, DiagramConnection } from './types';

/**
 * Hierarchical DAG layout — Sugiyama-lite.
 *
 *   1. Compute each node's *level* = longest path from a root predecessor.
 *   2. Group nodes by level (these become rows, top → bottom).
 *   3. Order each row by the average column index of its predecessors
 *      (barycentric heuristic) — reduces edge crossings without solving
 *      the full minimum-crossings problem.
 *   4. Position rows top-to-bottom, columns centered or anchored to the
 *      left margin if a row would clip past the canvas edge.
 *
 * Works on disconnected graphs (each weakly-connected component gets its
 * own level chain). Handles cycles by breaking back-edges at level
 * computation. Result is dramatically cleaner than the band-by-type
 * autoLayout for diagrams with non-trivial edge structure.
 */
const NODE_W = 180;
const NODE_H = 92;
const COL_PITCH = 230;
const ROW_PITCH = 150;
const MARGIN_X = 80;
const MARGIN_Y = 70;
const CANVAS_W_HINT = 1100; // soft hint for centering math

export function graphLayout(
  nodes: DiagramNode[],
  connections: DiagramConnection[]
): DiagramNode[] {
  if (nodes.length === 0) return nodes;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  nodes.forEach((n) => {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  });
  for (const c of connections) {
    if (!nodeById.has(c.fromNodeId) || !nodeById.has(c.toNodeId)) continue;
    if (c.fromNodeId === c.toNodeId) continue;
    outgoing.get(c.fromNodeId)!.push(c.toNodeId);
    incoming.get(c.toNodeId)!.push(c.fromNodeId);
  }

  // ─── 1. Levels via longest-path DFS, with cycle detection ─────────────
  const level = new Map<string, number>();
  const visiting = new Set<string>();
  function computeLevel(id: string): number {
    const cached = level.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) {
      // Back-edge in a cycle: pretend the predecessor is the root.
      level.set(id, 0);
      return 0;
    }
    visiting.add(id);
    const preds = incoming.get(id) ?? [];
    let lvl = 0;
    for (const p of preds) {
      const pl = computeLevel(p);
      if (pl + 1 > lvl) lvl = pl + 1;
    }
    visiting.delete(id);
    level.set(id, lvl);
    return lvl;
  }
  nodes.forEach((n) => computeLevel(n.id));

  // ─── 2. Group by level ────────────────────────────────────────────────
  const rows = new Map<number, DiagramNode[]>();
  for (const n of nodes) {
    const lvl = level.get(n.id) ?? 0;
    if (!rows.has(lvl)) rows.set(lvl, []);
    rows.get(lvl)!.push(n);
  }
  const sortedLevels = Array.from(rows.keys()).sort((a, b) => a - b);

  // ─── 3. Barycentric ordering — iterate to convergence (a few passes) ──
  const xRank = new Map<string, number>();
  // Initial rank: order in which nodes appeared in input.
  for (const lvl of sortedLevels) {
    const row = rows.get(lvl)!;
    row.forEach((n, i) => xRank.set(n.id, i));
  }
  // 4 passes is plenty for diagrams of this size.
  for (let pass = 0; pass < 4; pass++) {
    // Top-down sweep: order each row by avg predecessor rank.
    for (const lvl of sortedLevels) {
      if (lvl === 0) continue;
      const row = rows.get(lvl)!;
      const withAvg = row.map((n) => {
        const preds = (incoming.get(n.id) ?? []).filter((p) => xRank.has(p));
        const avg =
          preds.length === 0
            ? xRank.get(n.id) ?? 0
            : preds.reduce((s, p) => s + (xRank.get(p) ?? 0), 0) / preds.length;
        return { node: n, avg };
      });
      withAvg.sort((a, b) => a.avg - b.avg);
      withAvg.forEach((w, i) => xRank.set(w.node.id, i));
    }
    // Bottom-up sweep: order each row by avg successor rank.
    for (const lvl of [...sortedLevels].reverse()) {
      const row = rows.get(lvl)!;
      const withAvg = row.map((n) => {
        const succs = (outgoing.get(n.id) ?? []).filter((p) => xRank.has(p));
        const avg =
          succs.length === 0
            ? xRank.get(n.id) ?? 0
            : succs.reduce((s, p) => s + (xRank.get(p) ?? 0), 0) / succs.length;
        return { node: n, avg };
      });
      withAvg.sort((a, b) => a.avg - b.avg);
      withAvg.forEach((w, i) => xRank.set(w.node.id, i));
    }
  }

  // ─── 4. Place nodes ──────────────────────────────────────────────────
  const result: DiagramNode[] = [];
  for (const lvl of sortedLevels) {
    const row = rows
      .get(lvl)!
      .slice()
      .sort((a, b) => (xRank.get(a.id) ?? 0) - (xRank.get(b.id) ?? 0));

    const totalSpan = (row.length - 1) * COL_PITCH;
    // Center the row in the canvas; fall back to the left margin if a wide
    // row would clip past x=0.
    const centeredStart = (CANVAS_W_HINT - totalSpan - NODE_W) / 2;
    const startX = Math.max(MARGIN_X, centeredStart);
    const rowY = MARGIN_Y + lvl * ROW_PITCH;

    row.forEach((n, i) => {
      result.push({
        ...n,
        x: Math.round(startX + i * COL_PITCH),
        y: Math.round(rowY),
        width: n.width ?? NODE_W,
        height: n.height ?? NODE_H,
      });
    });
  }

  // Preserve original insertion order in the returned array so downstream
  // ID-based lookups stay stable.
  const byId = new Map(result.map((n) => [n.id, n]));
  return nodes.map((n) => byId.get(n.id) ?? n);
}
