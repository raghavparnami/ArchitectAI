'use client';
import {
  MousePointer2,
  Spline,
  Pencil,
  Hand,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo2,
  Redo2,
  Download,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useCanvasStore } from '@/stores/canvas.store';
import { CanvasTool } from '@/lib/types';
import { useEffect, useState } from 'react';

const tools: { id: CanvasTool; label: string; icon: React.ElementType }[] = [
  { id: 'select',   label: 'Select (V)',   icon: MousePointer2 },
  { id: 'connect',  label: 'Connect (C)',  icon: Spline },
  { id: 'freehand', label: 'Freehand',     icon: Pencil },
  { id: 'pan',      label: 'Pan (H)',      icon: Hand },
];

interface ToolbarProps {
  onFitToScreen?: () => void;
  onExport?: (format: 'png' | 'svg') => void;
}

export function Toolbar({ onFitToScreen, onExport }: ToolbarProps) {
  const tool = useCanvasStore((s) => s.tool);
  const zoom = useCanvasStore((s) => s.zoom);
  const setTool = useCanvasStore((s) => s.setTool);
  const setZoom = useCanvasStore((s) => s.setZoom);

  // Subscribe to undo/redo availability
  const [, force] = useState(0);
  useEffect(() => {
    return useCanvasStore.temporal.subscribe(() => force((n) => n + 1));
  }, []);

  const undo = () => useCanvasStore.temporal.getState().undo();
  const redo = () => useCanvasStore.temporal.getState().redo();
  const pastStates = useCanvasStore.temporal.getState().pastStates;
  const futureStates = useCanvasStore.temporal.getState().futureStates;
  const canUndo = pastStates.length > 0;
  const canRedo = futureStates.length > 0;

  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white border border-[var(--hairline)] rounded-lg shadow-sm px-1.5 py-1">
      {tools.map((t) => {
        const Icon = t.icon;
        const active = tool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={t.label}
            className={clsx(
              'h-8 w-8 inline-flex items-center justify-center rounded',
              active ? 'bg-[var(--foreground)] text-[var(--background)]' : 'text-[var(--muted)] hover:bg-neutral-100'
            )}
          >
            <Icon size={15} />
          </button>
        );
      })}

      <div className="w-px h-5 bg-[var(--hairline)] mx-1" />

      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (⌘Z)"
        className="h-8 w-8 inline-flex items-center justify-center rounded text-[var(--muted)] hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Undo2 size={15} />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        title="Redo (⌘⇧Z)"
        className="h-8 w-8 inline-flex items-center justify-center rounded text-[var(--muted)] hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Redo2 size={15} />
      </button>

      <div className="w-px h-5 bg-[var(--hairline)] mx-1" />

      <button
        onClick={() => setZoom(zoom - 0.1)}
        className="h-8 w-8 inline-flex items-center justify-center rounded text-[var(--muted)] hover:bg-neutral-100"
        title="Zoom out"
      >
        <ZoomOut size={15} />
      </button>
      <span className="text-[11px] font-mono tnum w-10 text-center text-[var(--muted)]">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => setZoom(zoom + 0.1)}
        className="h-8 w-8 inline-flex items-center justify-center rounded text-[var(--muted)] hover:bg-neutral-100"
        title="Zoom in"
      >
        <ZoomIn size={15} />
      </button>
      <button
        onClick={onFitToScreen}
        className="h-8 w-8 inline-flex items-center justify-center rounded text-[var(--muted)] hover:bg-neutral-100"
        title="Fit to screen"
      >
        <Maximize2 size={15} />
      </button>

      <div className="w-px h-5 bg-[var(--hairline)] mx-1" />

      <div className="relative">
        <button
          onClick={() => setExportOpen((o) => !o)}
          className="h-8 px-2 inline-flex items-center gap-1 rounded text-[var(--muted)] hover:bg-neutral-100"
          title="Export"
        >
          <Download size={14} />
          <span className="text-[10px] font-mono uppercase">Export</span>
        </button>
        {exportOpen && (
          <div className="absolute top-9 right-0 bg-white border border-[var(--hairline)] rounded-md shadow-lg p-1 z-30 min-w-[120px]">
            <button
              onClick={() => {
                onExport?.('png');
                setExportOpen(false);
              }}
              className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-neutral-100 rounded"
            >
              PNG image
            </button>
            <button
              onClick={() => {
                onExport?.('svg');
                setExportOpen(false);
              }}
              className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-neutral-100 rounded"
            >
              SVG vector
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
