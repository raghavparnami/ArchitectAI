'use client';
import { memo, MouseEvent, useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { DiagramNode, NodeShape, Port } from '@/lib/types';
import { getTech, NODE_TYPE_COLORS } from '@/lib/tech-catalog';
import { NODE_W, NODE_H } from '@/lib/canvas-utils';
import { sanitizeLabel } from '@/lib/labels';
import { TechLogo } from './TechLogo';
import {
  Key,
  Link2,
  Lock,
  Box,
  Database,
  Server,
  ListPlus,
  DoorOpen,
  Monitor,
  Lightbulb,
  ShieldCheck,
  Activity,
  Cloud,
  Brain,
  Globe2,
} from 'lucide-react';

// Map each node type to a representative lucide icon. Used as the small
// glyph in the top-left of every card when the node has no tech logo set.
const TYPE_ICON = {
  service:  Server,
  database: Database,
  queue:    ListPlus,
  gateway:  DoorOpen,
  frontend: Monitor,
  cache:    Lightbulb,
  auth:     ShieldCheck,
  monitor:  Activity,
  cdn:      Cloud,
  ml:       Brain,
  external: Globe2,
  shape:    Box,
  entity:   Box,
} as const;

interface CanvasNodeProps {
  node: DiagramNode;
  selected: boolean;
  isConnectingSource: boolean;
  readOnly?: boolean;
  onMouseDown: (e: MouseEvent, id: string) => void;
  onHandleMouseDown: (e: MouseEvent, id: string, port: Port) => void;
  onResizeHandleMouseDown: (e: MouseEvent, id: string, handle: 'nw' | 'ne' | 'sw' | 'se') => void;
  onLabelChange: (id: string, label: string) => void;
  onContextMenu?: (e: MouseEvent) => void;
}

function CanvasNodeImpl({
  node,
  selected,
  isConnectingSource,
  readOnly,
  onMouseDown,
  onHandleMouseDown,
  onResizeHandleMouseDown,
  onLabelChange,
  onContextMenu,
}: CanvasNodeProps) {
  const tech = node.techId ? getTech(node.techId) : undefined;
  const typeColor = NODE_TYPE_COLORS[node.type] ?? '#6F6A60';
  const isEntity = node.type === 'entity';
  const fields = node.fields ?? [];
  // Defensive sanitization: data already in the store may contain raw HTML
  // entities (`<br/>`, `&lt;`, etc.) from before sanitizeLabel was tightened.
  // Render through the sanitizer so existing diagrams clean up on next view.
  const cleanLabel = sanitizeLabel(node.label);
  // Entity height grows with field count
  const baseW = node.width ?? NODE_W;
  const baseH = isEntity ? Math.max(80, 36 + fields.length * 22) : (node.height ?? NODE_H);
  const w = baseW;
  const h = baseH;
  const shape: NodeShape = node.shape ?? 'rect';
  const isCard = (shape === 'rect' && node.type !== 'shape') || isEntity;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cleanLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => { setDraft(cleanLabel); }, [cleanLabel]);

  const commit = () => {
    if (draft.trim() && draft !== cleanLabel) {
      onLabelChange(node.id, draft.trim());
    } else {
      setDraft(cleanLabel);
    }
    setEditing(false);
  };

  const fill = isEntity
    ? '#FFFFFF'
    : node.fill ?? (tech ? `${tech.color}12` : '#FFFFFF');
  const stroke = node.stroke ?? (tech ? `${tech.color}88` : '#E8E4D8');

  return (
    <div
      data-node-id={node.id}
      onMouseDown={(e) => !readOnly && !editing && onMouseDown(e, node.id)}
      onContextMenu={(e) => onContextMenu?.(e)}
      onDoubleClick={(e) => {
        if (readOnly || node.locked) return;
        e.stopPropagation();
        setEditing(true);
      }}
      className={clsx(
        'absolute select-none transition-shadow',
        !readOnly && !editing && !node.locked && 'cursor-grab active:cursor-grabbing',
        node.locked && 'cursor-not-allowed'
      )}
      style={{ left: node.x, top: node.y, width: w, height: h, zIndex: node.z ?? 0 }}
    >
      <ShapeFrame
        shape={isEntity ? 'rect' : shape}
        width={w}
        height={h}
        fill={fill}
        stroke={stroke}
        selected={selected}
        connectingSource={isConnectingSource}
        typeColor={typeColor}
      />

      {/* ─── Entity (ER) layout ────────────────────────────────────────── */}
      {isEntity && (
        <div className="absolute inset-0 flex flex-col">
          <div
            className="px-2.5 py-1.5 border-b font-semibold text-[12px] truncate"
            style={{ borderColor: '#E8E4D8', backgroundColor: '#F5E9DF', color: '#0E0F10' }}
          >
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit();
                  if (e.key === 'Escape') { setDraft(cleanLabel); setEditing(false); }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full bg-white rounded px-1 outline-none ring-1 ring-neutral-300 text-[12px] font-semibold"
              />
            ) : (
              cleanLabel
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            {fields.length === 0 ? (
              <div className="text-[10px] text-[var(--muted)] text-center py-2 italic">
                Add fields in Properties
              </div>
            ) : (
              fields.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] border-b last:border-b-0"
                  style={{ borderColor: '#F0EDE0' }}
                >
                  {f.pk && <Key size={9} className="text-amber-600 shrink-0" />}
                  {f.fk && !f.pk && <Link2 size={9} className="text-blue-600 shrink-0" />}
                  {!f.pk && !f.fk && <span className="w-[9px] shrink-0" />}
                  <span className="font-medium truncate flex-1">{f.name}</span>
                  <span className="text-[10px] text-[var(--muted)] font-mono">{f.type}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── Tech / generic card layout ─────────────────────────────────── */}
      {isCard && !isEntity && (
        <div className="absolute inset-0 flex flex-col">
          <div className="flex items-center justify-between px-2.5 pt-2">
            {tech ? (
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center bg-white border"
                style={{ borderColor: `${tech.color}66` }}
              >
                <TechLogo tech={tech} size={16} />
              </div>
            ) : (() => {
                // No tech logo set — fall back to a type-flavored lucide icon
                // so the corner glyph isn't an empty placeholder square.
                const Icon = TYPE_ICON[node.type as keyof typeof TYPE_ICON] ?? Box;
                return (
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{
                      backgroundColor: `${typeColor}14`,
                      border: `1px solid ${typeColor}40`,
                    }}
                  >
                    <Icon size={14} color={typeColor} strokeWidth={2} />
                  </div>
                );
              })()}
            <span
              className="px-1.5 py-0.5 rounded font-mono text-[9px] uppercase tracking-wide"
              style={{ backgroundColor: `${typeColor}22`, color: typeColor }}
            >
              {node.type}
            </span>
          </div>
          <div className="px-2.5 pt-1 flex-1 min-h-0">
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit();
                  if (e.key === 'Escape') { setDraft(cleanLabel); setEditing(false); }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full text-[13px] font-semibold bg-neutral-50 rounded px-1 outline-none ring-1 ring-neutral-300"
              />
            ) : (
              <div className="text-[12px] font-semibold leading-tight whitespace-pre-line break-words line-clamp-3">
                {cleanLabel}
              </div>
            )}
            {node.desc && !editing && (
              <div className="text-[10px] text-[var(--muted)] leading-tight mt-0.5 line-clamp-2">
                {node.desc}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Plain shape (centered label) ───────────────────────────────── */}
      {!isCard && !isEntity && (
        <div className="absolute inset-0 flex items-center justify-center px-3 pointer-events-none">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') { setDraft(cleanLabel); setEditing(false); }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="pointer-events-auto text-center text-[13px] font-semibold bg-white rounded px-1 outline-none ring-1 ring-neutral-300 w-[80%]"
            />
          ) : (
            <div className="text-center text-[12px] font-semibold text-[var(--foreground)] leading-tight whitespace-pre-line break-words line-clamp-3">
              {cleanLabel}
            </div>
          )}
        </div>
      )}

      {/* Lock indicator */}
      {node.locked && (
        <div
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-[var(--hairline)] inline-flex items-center justify-center shadow-sm"
          title="Locked"
        >
          <Lock size={9} className="text-[var(--muted)]" />
        </div>
      )}

      {/* ─── Hover-to-connect handles ───────────────────────────────────── */}
      {selected && !readOnly && !editing && !node.locked && (
        <>
          {(['n', 's', 'e', 'w'] as const).map((port) => {
            const handleStyle: React.CSSProperties = {
              position: 'absolute',
              width: 14,
              height: 14,
              borderRadius: 999,
              background: 'white',
              border: `2px solid ${typeColor}`,
              cursor: 'crosshair',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: typeColor,
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '10px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              zIndex: 10,
            };
            if (port === 'n') Object.assign(handleStyle, { top: -8, left: w / 2 - 7 });
            if (port === 's') Object.assign(handleStyle, { bottom: -8, left: w / 2 - 7 });
            if (port === 'e') Object.assign(handleStyle, { right: -8, top: h / 2 - 7 });
            if (port === 'w') Object.assign(handleStyle, { left: -8, top: h / 2 - 7 });
            return (
              <div
                key={port}
                style={handleStyle}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onHandleMouseDown(e, node.id, port);
                }}
                title="Drag to connect"
              >
                +
              </div>
            );
          })}
        </>
      )}

      {/* ─── Resize handles (4 corners) ─────────────────────────────────── */}
      {selected && !readOnly && !editing && !node.locked && (
        <>
          {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
            const cs: React.CSSProperties = {
              position: 'absolute',
              width: 10,
              height: 10,
              background: 'white',
              border: `1.5px solid ${typeColor}`,
              borderRadius: 2,
              zIndex: 11,
            };
            const c =
              corner === 'nw' ? 'nwse-resize'
              : corner === 'se' ? 'nwse-resize'
              : 'nesw-resize';
            cs.cursor = c;
            if (corner === 'nw') Object.assign(cs, { top: -5, left: -5 });
            if (corner === 'ne') Object.assign(cs, { top: -5, right: -5 });
            if (corner === 'sw') Object.assign(cs, { bottom: -5, left: -5 });
            if (corner === 'se') Object.assign(cs, { bottom: -5, right: -5 });
            return (
              <div
                key={corner}
                style={cs}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onResizeHandleMouseDown(e, node.id, corner);
                }}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

function ShapeFrame({
  shape,
  width,
  height,
  fill,
  stroke,
  selected,
  connectingSource,
  typeColor,
}: {
  shape: NodeShape;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  selected: boolean;
  connectingSource: boolean;
  typeColor: string;
}) {
  const strokeWidth = selected ? 2 : 1.25;
  const strokeColor = selected ? typeColor : connectingSource ? '#C7521B' : stroke;

  const path = (() => {
    switch (shape) {
      case 'rect':
      case 'ellipse':
      case 'circle':
        return null;
      case 'diamond':
        return `M ${width / 2} 1 L ${width - 1} ${height / 2} L ${width / 2} ${height - 1} L 1 ${height / 2} Z`;
      case 'hexagon': {
        const inset = height * 0.25;
        return `M ${inset} 1 L ${width - inset} 1 L ${width - 1} ${height / 2} L ${width - inset} ${height - 1} L ${inset} ${height - 1} L 1 ${height / 2} Z`;
      }
      case 'parallelogram': {
        const skew = width * 0.15;
        return `M ${skew} 1 L ${width - 1} 1 L ${width - skew} ${height - 1} L 1 ${height - 1} Z`;
      }
      case 'triangle':
        return `M ${width / 2} 1 L ${width - 1} ${height - 1} L 1 ${height - 1} Z`;
      case 'cloud': {
        const w = width;
        const h = height;
        return `M ${w * 0.2} ${h * 0.7} C ${w * 0.0} ${h * 0.7} ${w * 0.0} ${h * 0.4} ${w * 0.2} ${h * 0.4} C ${w * 0.2} ${h * 0.15} ${w * 0.5} ${h * 0.15} ${w * 0.55} ${h * 0.3} C ${w * 0.65} ${h * 0.1} ${w * 0.9} ${h * 0.2} ${w * 0.85} ${h * 0.4} C ${w * 1.0} ${h * 0.45} ${w * 1.0} ${h * 0.7} ${w * 0.85} ${h * 0.7} Z`;
      }
      default:
        return null;
    }
  })();

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
      style={{ overflow: 'visible' }}
    >
      {shape === 'rect' && (
        <rect
          x={0.5}
          y={0.5}
          width={width - 1}
          height={height - 1}
          rx={8}
          ry={8}
          fill={fill}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          style={{ filter: selected ? `drop-shadow(0 4px 12px rgba(199,82,27,0.10))` : undefined }}
        />
      )}
      {shape === 'ellipse' && (
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2 - 1}
          ry={height / 2 - 1}
          fill={fill}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )}
      {shape === 'circle' && (
        <circle
          cx={width / 2}
          cy={height / 2}
          r={Math.min(width, height) / 2 - 1}
          fill={fill}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )}
      {shape === 'cylinder' && (
        <g>
          <ellipse cx={width / 2} cy={12} rx={width / 2 - 1} ry={8} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          <path d={`M 1 12 L 1 ${height - 12} A ${width / 2 - 1} 8 0 0 0 ${width - 1} ${height - 12} L ${width - 1} 12`} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          <path d={`M 1 ${height - 12} A ${width / 2 - 1} 8 0 0 0 ${width - 1} ${height - 12}`} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />
        </g>
      )}
      {shape === 'sticky' && (
        <g style={{ filter: 'drop-shadow(2px 3px 4px rgba(0,0,0,0.12))' }}>
          <rect
            x={1}
            y={1}
            width={width - 2}
            height={height - 2}
            fill="#FEF3C7"
            stroke={selected ? '#C7521B' : '#FCD34D'}
            strokeWidth={strokeWidth}
          />
        </g>
      )}
      {path && (
        <path d={path} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
      )}
    </svg>
  );
}

export const CanvasNode = memo(CanvasNodeImpl);
