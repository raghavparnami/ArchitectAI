'use client';
import { useCanvasStore } from '@/stores/canvas.store';
import { useMemo } from 'react';

const MAP_W = 180;
const MAP_H = 120;

export function MiniMap() {
  const nodes = useCanvasStore((s) => s.nodes);
  const setPan = useCanvasStore((s) => s.setPan);
  const zoom = useCanvasStore((s) => s.zoom);

  const { viewBox, scale, offsetX, offsetY } = useMemo(() => {
    if (nodes.length === 0) {
      return { viewBox: '0 0 4000 3000', scale: 1, offsetX: 0, offsetY: 0 };
    }
    const padding = 80;
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs) - padding;
    const minY = Math.min(...ys) - padding;
    const maxX = Math.max(...nodes.map((n) => n.x + (n.width ?? 140))) + padding;
    const maxY = Math.max(...nodes.map((n) => n.y + (n.height ?? 80))) + padding;
    const w = maxX - minX;
    const h = maxY - minY;
    return {
      viewBox: `${minX} ${minY} ${w} ${h}`,
      scale: Math.min(MAP_W / w, MAP_H / h),
      offsetX: minX,
      offsetY: minY,
    };
  }, [nodes]);

  if (nodes.length === 0) return null;

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    // Find which canvas coord this maps to
    const [vbx, vby, vbw, vbh] = viewBox.split(' ').map(Number);
    const targetX = vbx + px * vbw;
    const targetY = vby + py * vbh;
    // Center the viewport on this point. Assume container is roughly 800x600 visible.
    setPan(-targetX * zoom + 400, -targetY * zoom + 300);
  };

  // Suppress unused-var warnings — scale/offsets are computed but not strictly needed below
  void scale;
  void offsetX;
  void offsetY;

  return (
    <div className="absolute bottom-4 right-4 z-20 bg-white/95 backdrop-blur border border-[var(--hairline)] rounded-md shadow-md overflow-hidden">
      <div className="px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-[var(--muted)] border-b border-[var(--hairline)]">
        Map
      </div>
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        width={MAP_W}
        height={MAP_H}
        onClick={handleClick}
        className="cursor-pointer block"
      >
        {nodes.map((n) => (
          <rect
            key={n.id}
            x={n.x}
            y={n.y}
            width={n.width ?? 140}
            height={n.height ?? 80}
            rx={6}
            fill="#C7521B"
            fillOpacity={0.18}
            stroke="#C7521B"
            strokeWidth={2}
          />
        ))}
      </svg>
    </div>
  );
}
