'use client';
import { useState } from 'react';
import { Search, Box, Layers, Shapes as ShapesIcon, Database, ChevronLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { TECH_CATALOG, TECH_BY_CATEGORY, CATEGORY_LABELS, NODE_TYPE_COLORS } from '@/lib/tech-catalog';
import { useCanvasStore } from '@/stores/canvas.store';
import { NodeType, NodeShape, DiagramGroup, TechItem } from '@/lib/types';
import { Input } from '@/components/ui/Input';
import { TechLogo } from './TechLogo';

type Tab = 'shapes' | 'components' | 'generic' | 'containers';

const GENERIC_NODES: { type: NodeType; label: string }[] = [
  { type: 'gateway',  label: 'API Gateway' },
  { type: 'service',  label: 'Service' },
  { type: 'queue',    label: 'Queue' },
  { type: 'database', label: 'Database' },
  { type: 'cache',    label: 'Cache' },
  { type: 'auth',     label: 'Auth' },
  { type: 'monitor',  label: 'Monitor' },
  { type: 'cdn',      label: 'CDN' },
  { type: 'ml',       label: 'ML Model' },
  { type: 'external', label: 'External API' },
];

const SHAPES: { shape: NodeShape; label: string }[] = [
  { shape: 'rect',          label: 'Rectangle' },
  { shape: 'ellipse',       label: 'Ellipse' },
  { shape: 'circle',        label: 'Circle' },
  { shape: 'diamond',       label: 'Diamond' },
  { shape: 'hexagon',       label: 'Hexagon' },
  { shape: 'parallelogram', label: 'Parallelogram' },
  { shape: 'triangle',      label: 'Triangle' },
  { shape: 'cylinder',      label: 'Cylinder' },
  { shape: 'cloud',         label: 'Cloud' },
  { shape: 'sticky',        label: 'Sticky note' },
];

const CONTAINER_TYPES: { type: DiagramGroup['type']; label: string; color: string }[] = [
  { type: 'vpc',     label: 'VPC',     color: '#3B82F6' },
  { type: 'k8s',     label: 'Kubernetes Cluster', color: '#326CE5' },
  { type: 'region',  label: 'Region',  color: '#10B981' },
  { type: 'zone',    label: 'Zone',    color: '#F59E0B' },
  { type: 'generic', label: 'Group',   color: '#6B7280' },
];

const PALETTE_MIME = 'application/x-architect-palette';

interface ComponentPaletteProps {
  open?: boolean;
  onToggle?: () => void;
}

export function ComponentPalette({ open = true, onToggle }: ComponentPaletteProps) {
  const [tab, setTab] = useState<Tab>('shapes');
  const [query, setQuery] = useState('');

  if (!open) {
    return (
      <aside className="w-9 border-r border-[var(--hairline)] bg-white flex flex-col items-center pt-3 shrink-0">
        <button
          onClick={onToggle}
          className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]"
          title="Show palette"
        >
          <ShapesIcon size={14} />
        </button>
      </aside>
    );
  }

  const addGroup = useCanvasStore((s) => s.addGroup);
  const groups = useCanvasStore((s) => s.groups);

  const handleAddContainer = (type: DiagramGroup['type'], label: string, color: string) => {
    const offset = groups.length * 30;
    addGroup({
      id: `group_${Date.now()}`,
      label,
      type,
      x: 80 + offset,
      y: 80 + offset,
      width: 360,
      height: 240,
      nodeIds: [],
      color,
    });
  };

  const filteredTechs = query
    ? TECH_CATALOG.filter((t) => t.label.toLowerCase().includes(query.toLowerCase()))
    : null;

  const TABS: { id: Tab; label: string; icon: typeof Box }[] = [
    { id: 'shapes',     label: 'Shapes',    icon: ShapesIcon },
    { id: 'components', label: 'Tech',      icon: Box },
    { id: 'generic',    label: 'Generic',   icon: Layers },
    { id: 'containers', label: 'Container', icon: Layers },
  ];

  return (
    <aside className="w-60 border-r border-[var(--hairline)] bg-white flex flex-col shrink-0">
      <div className="px-3 pt-3 pb-2 border-b border-[var(--hairline)]">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)]">
            Drag onto canvas
          </div>
          {onToggle && (
            <button
              onClick={onToggle}
              className="p-0.5 rounded hover:bg-neutral-100 text-[var(--muted)]"
              title="Collapse palette"
            >
              <ChevronLeft size={12} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1 mb-2 bg-neutral-100 rounded-md p-0.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'inline-flex items-center justify-center gap-1 h-7 rounded text-[9px] font-mono font-semibold uppercase transition',
                  active ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'
                )}
                title={t.label}
              >
                <Icon size={11} />
                {t.label}
              </button>
            );
          })}
        </div>
        {tab === 'components' && (
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tech…"
              className="h-8 pl-7 text-xs"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {tab === 'shapes' && (
          <div>
            <p className="text-[10px] text-[var(--muted)] mb-2 leading-relaxed">
              Drag onto the canvas. Double-click to rename, then drag the + handles to connect.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {SHAPES.map((s) => (
                <ShapeTile key={s.shape} shape={s.shape} label={s.label} />
              ))}
            </div>
            <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              Database / ER
            </div>
            <EntityTile />
          </div>
        )}

        {tab === 'components' &&
          (filteredTechs ? (
            <div className="grid grid-cols-2 gap-1.5">
              {filteredTechs.map((t) => (
                <TechTile key={t.id} tech={t} />
              ))}
              {filteredTechs.length === 0 && (
                <div className="col-span-2 text-center text-xs text-neutral-400 py-6">
                  No matches
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(TECH_BY_CATEGORY).map(([cat, items]) => (
                <div key={cat}>
                  <div className="text-[9px] font-mono font-semibold uppercase tracking-wide text-neutral-400 mb-1.5">
                    {CATEGORY_LABELS[cat]}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((t) => (
                      <TechTile key={t.id} tech={t} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

        {tab === 'generic' && (
          <div className="space-y-1.5">
            {GENERIC_NODES.map((n) => {
              const color = NODE_TYPE_COLORS[n.type];
              return (
                <div
                  key={n.type + n.label}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData(
                      PALETTE_MIME,
                      JSON.stringify({ kind: 'generic', type: n.type, label: n.label })
                    );
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border border-neutral-200 bg-white hover:border-neutral-400 hover:shadow-sm transition text-left cursor-grab active:cursor-grabbing"
                >
                  <span
                    className="w-6 h-6 rounded inline-flex items-center justify-center font-mono text-[8px] font-bold uppercase shrink-0"
                    style={{ backgroundColor: `${color}22`, color }}
                  >
                    {n.type.slice(0, 2)}
                  </span>
                  <span className="text-xs font-medium">{n.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'containers' && (
          <div className="space-y-1.5">
            {CONTAINER_TYPES.map((c) => (
              <button
                key={c.type}
                onClick={() => handleAddContainer(c.type, c.label, c.color)}
                className="w-full flex items-center gap-2 px-2.5 py-2.5 rounded-md border-2 border-dashed transition text-left hover:bg-neutral-50"
                style={{ borderColor: `${c.color}66` }}
              >
                <span
                  className="w-6 h-6 rounded inline-flex items-center justify-center font-mono text-[8px] font-bold uppercase"
                  style={{ backgroundColor: `${c.color}22`, color: c.color }}
                >
                  ☐
                </span>
                <span className="text-xs font-medium">{c.label}</span>
              </button>
            ))}
            <p className="text-[10px] text-neutral-400 px-1 pt-2 leading-relaxed">
              Containers are background frames. Drag by their label.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Draggable tiles ──────────────────────────────────────────────────────

function ShapeTile({ shape, label }: { shape: NodeShape; label: string }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData(
          PALETTE_MIME,
          JSON.stringify({ kind: 'shape', shape, label })
        );
      }}
      className="aspect-square rounded-md border border-neutral-200 bg-white hover:border-neutral-900 hover:shadow-sm transition cursor-grab active:cursor-grabbing flex flex-col items-center justify-center gap-1 p-1"
      title={`Drag ${label} onto canvas`}
    >
      <ShapePreview shape={shape} />
      <span className="text-[9px] text-neutral-500 font-medium">{label}</span>
    </div>
  );
}

function TechTile({ tech }: { tech: TechItem }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData(
          PALETTE_MIME,
          JSON.stringify({ kind: 'tech', techId: tech.id })
        );
      }}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-[var(--hairline)] bg-white hover:border-[var(--foreground)] hover:shadow-sm transition text-left cursor-grab active:cursor-grabbing"
      title={`Drag ${tech.label}`}
    >
      <span
        className="w-5 h-5 rounded inline-flex items-center justify-center bg-white shrink-0 border border-[var(--hairline)]"
      >
        <TechLogo tech={tech} size={12} />
      </span>
      <span className="text-[11px] truncate">{tech.label}</span>
    </div>
  );
}

function EntityTile() {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData(
          PALETTE_MIME,
          JSON.stringify({ kind: 'entity', label: 'Entity' })
        );
      }}
      className="w-full flex items-center gap-2 px-2.5 py-2.5 rounded-md border border-[var(--hairline)] bg-white hover:border-[var(--accent)] hover:shadow-sm transition text-left cursor-grab active:cursor-grabbing"
      title="Drag an entity onto canvas"
    >
      <span
        className="w-7 h-7 rounded-md inline-flex items-center justify-center"
        style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
      >
        <Database size={13} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold">Entity</div>
        <div className="text-[10px] text-[var(--muted)]">Table with fields</div>
      </div>
    </div>
  );
}

// ─── Tiny SVG previews of each shape ──────────────────────────────────────

function ShapePreview({ shape }: { shape: NodeShape }) {
  const stroke = '#374151';
  const fill = '#F9FAFB';
  const sw = 1.5;
  return (
    <svg width="32" height="24" viewBox="0 0 32 24" className="text-neutral-700">
      {shape === 'rect' && <rect x="2" y="3" width="28" height="18" rx="3" fill={fill} stroke={stroke} strokeWidth={sw} />}
      {shape === 'ellipse' && <ellipse cx="16" cy="12" rx="14" ry="9" fill={fill} stroke={stroke} strokeWidth={sw} />}
      {shape === 'circle' && <circle cx="16" cy="12" r="10" fill={fill} stroke={stroke} strokeWidth={sw} />}
      {shape === 'diamond' && <polygon points="16,2 30,12 16,22 2,12" fill={fill} stroke={stroke} strokeWidth={sw} />}
      {shape === 'hexagon' && <polygon points="8,3 24,3 30,12 24,21 8,21 2,12" fill={fill} stroke={stroke} strokeWidth={sw} />}
      {shape === 'parallelogram' && <polygon points="6,3 30,3 26,21 2,21" fill={fill} stroke={stroke} strokeWidth={sw} />}
      {shape === 'triangle' && <polygon points="16,3 30,21 2,21" fill={fill} stroke={stroke} strokeWidth={sw} />}
      {shape === 'cylinder' && (
        <g fill={fill} stroke={stroke} strokeWidth={sw}>
          <ellipse cx="16" cy="5" rx="12" ry="2.5" />
          <path d="M 4 5 L 4 19 A 12 2.5 0 0 0 28 19 L 28 5" />
          <path d="M 4 19 A 12 2.5 0 0 0 28 19" fill="none" />
        </g>
      )}
      {shape === 'cloud' && (
        <path
          d="M 8 18 C 3 18 3 11 8 11 C 8 5 16 5 17 9 C 19 4 27 6 26 11 C 30 12 30 18 26 18 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      )}
      {shape === 'sticky' && (
        <g>
          <rect x="3" y="3" width="26" height="18" fill="#FEF3C7" stroke="#D97706" strokeWidth={sw} />
          <line x1="6" y1="9" x2="26" y2="9" stroke="#D97706" strokeWidth="0.5" opacity="0.4" />
          <line x1="6" y1="13" x2="26" y2="13" stroke="#D97706" strokeWidth="0.5" opacity="0.4" />
          <line x1="6" y1="17" x2="22" y2="17" stroke="#D97706" strokeWidth="0.5" opacity="0.4" />
        </g>
      )}
    </svg>
  );
}
