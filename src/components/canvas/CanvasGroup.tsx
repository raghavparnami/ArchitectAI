'use client';
import { memo, MouseEvent as RM } from 'react';
import { DiagramGroup } from '@/lib/types';
import { X } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas.store';

interface CanvasGroupProps {
  group: DiagramGroup;
  readOnly?: boolean;
  onDragStart: (e: RM, id: string) => void;
  onResizeStart?: (e: RM, id: string, handle: 'nw' | 'ne' | 'sw' | 'se') => void;
}

function CanvasGroupImpl({ group, readOnly, onDragStart, onResizeStart }: CanvasGroupProps) {
  const deleteGroup = useCanvasStore((s) => s.deleteGroup);
  const color = group.color || '#6B7280';

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        left: group.x,
        top: group.y,
        width: group.width,
        height: group.height,
      }}
    >
      <div
        className="absolute inset-0 rounded-lg border-2 border-dashed"
        style={{
          borderColor: `${color}88`,
          backgroundColor: `${color}0A`,
        }}
      />
      <div
        className="absolute -top-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase tracking-wide cursor-grab active:cursor-grabbing"
        style={{ backgroundColor: color, color: 'white' }}
        onMouseDown={(e) => !readOnly && onDragStart(e, group.id)}
      >
        {group.label}
        {!readOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteGroup(group.id);
            }}
            className="ml-1 hover:bg-white/20 rounded p-0.5"
          >
            <X size={9} />
          </button>
        )}
      </div>

      {/* Resize handles */}
      {!readOnly && onResizeStart && (
        <>
          {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
            const style: React.CSSProperties = {
              position: 'absolute',
              width: 12,
              height: 12,
              background: 'white',
              border: `2px solid ${color}`,
              borderRadius: 2,
              zIndex: 5,
              cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
            };
            if (corner === 'nw') Object.assign(style, { top: -6, left: -6 });
            if (corner === 'ne') Object.assign(style, { top: -6, right: -6 });
            if (corner === 'sw') Object.assign(style, { bottom: -6, left: -6 });
            if (corner === 'se') Object.assign(style, { bottom: -6, right: -6 });
            return (
              <div
                key={corner}
                style={style}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onResizeStart(e, group.id, corner);
                }}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

export const CanvasGroup = memo(CanvasGroupImpl);
