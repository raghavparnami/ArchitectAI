'use client';
import { useEffect, useState, useMemo } from 'react';
import { useCanvasStore } from '@/stores/canvas.store';
import { Search, Box } from 'lucide-react';
import { NODE_TYPE_COLORS } from '@/lib/tech-catalog';

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function SearchPalette({ open, onClose }: SearchPaletteProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const select = useCanvasStore((s) => s.select);
  const setPan = useCanvasStore((s) => s.setPan);
  const zoom = useCanvasStore((s) => s.zoom);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIdx(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes.slice(0, 20);
    return nodes
      .filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          n.type.toLowerCase().includes(q) ||
          (n.desc?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 20);
  }, [nodes, query]);

  const jumpTo = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    select([id]);
    // Center node in approximate viewport
    setPan(-node.x * zoom + 400, -node.y * zoom + 300);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, results.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const node = results[activeIdx];
        if (node) jumpTo(node.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, activeIdx]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[min(560px,calc(100%-32px))] bg-white border border-[var(--hairline)] rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 h-12 border-b border-[var(--hairline)]">
          <Search size={15} className="text-[var(--muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            placeholder="Search nodes by label, type, description…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--muted)]"
          />
          <span className="font-mono text-[9px] text-[var(--muted)] border border-[var(--hairline)] rounded px-1.5 py-0.5">
            ESC
          </span>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[var(--muted)]">
              {nodes.length === 0 ? 'No nodes on canvas yet' : 'No matches'}
            </div>
          ) : (
            results.map((n, i) => {
              const color = NODE_TYPE_COLORS[n.type] ?? '#6F6A60';
              return (
                <button
                  key={n.id}
                  onClick={() => jumpTo(n.id)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left ' +
                    (i === activeIdx ? 'bg-[var(--accent-soft)]' : 'hover:bg-neutral-50')
                  }
                >
                  <Box size={13} style={{ color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{n.label}</div>
                    {n.desc && (
                      <div className="text-[10px] text-[var(--muted)] truncate">{n.desc}</div>
                    )}
                  </div>
                  <span
                    className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${color}22`, color }}
                  >
                    {n.type}
                  </span>
                </button>
              );
            })
          )}
        </div>
        <div className="px-4 py-2 border-t border-[var(--hairline)] flex items-center justify-between text-[10px] font-mono text-[var(--muted)]">
          <span>{results.length} results</span>
          <span>↑↓ navigate · ↵ jump</span>
        </div>
      </div>
    </div>
  );
}
