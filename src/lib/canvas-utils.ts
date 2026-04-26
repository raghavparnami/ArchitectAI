import { DiagramNode, Port } from './types';

export const NODE_W = 180;
export const NODE_H = 96;

export function nodeCenter(node: DiagramNode) {
  return {
    x: node.x + (node.width ?? NODE_W) / 2,
    y: node.y + (node.height ?? NODE_H) / 2,
  };
}

export function portPosition(node: DiagramNode, port: Port) {
  const w = node.width ?? NODE_W;
  const h = node.height ?? NODE_H;
  switch (port) {
    case 'n': return { x: node.x + w / 2, y: node.y };
    case 's': return { x: node.x + w / 2, y: node.y + h };
    case 'e': return { x: node.x + w,     y: node.y + h / 2 };
    case 'w': return { x: node.x,         y: node.y + h / 2 };
  }
}

/**
 * Pick the best ports between two nodes based on relative position.
 * Source exits the side closest to target; target enters the opposite side.
 */
export function autoPorts(from: DiagramNode, to: DiagramNode): { fromPort: Port; toPort: Port } {
  const a = nodeCenter(from);
  const b = nodeCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { fromPort: 'e', toPort: 'w' }
      : { fromPort: 'w', toPort: 'e' };
  }
  return dy > 0
    ? { fromPort: 's', toPort: 'n' }
    : { fromPort: 'n', toPort: 's' };
}

/**
 * Cubic bezier path between two points, with control points biased
 * along the port axis for nice S-curves.
 */
export function bezierPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromPort: Port,
  toPort: Port
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.max(40, Math.hypot(dx, dy) * 0.4);

  const offset = (port: Port) => {
    switch (port) {
      case 'n': return { x: 0, y: -dist };
      case 's': return { x: 0, y: dist };
      case 'e': return { x: dist, y: 0 };
      case 'w': return { x: -dist, y: 0 };
    }
  };

  const c1 = offset(fromPort);
  const c2 = offset(toPort);

  const cx1 = from.x + c1.x;
  const cy1 = from.y + c1.y;
  const cx2 = to.x + c2.x;
  const cy2 = to.y + c2.y;

  return `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`;
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
