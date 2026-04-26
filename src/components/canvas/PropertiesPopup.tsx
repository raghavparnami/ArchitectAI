'use client';
import { useCanvasStore } from '@/stores/canvas.store';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { NodeType, EntityField } from '@/lib/types';
import { TECH_CATALOG } from '@/lib/tech-catalog';
import {
  Trash2,
  Plus,
  X,
  Lock,
  Unlock,
  Key,
  Link2,
  Minus,
  MoreHorizontal,
} from 'lucide-react';
import { clsx } from 'clsx';

const COLOR_PALETTE = [
  { name: 'Default', fill: undefined,  stroke: undefined,  ring: '#E5E1D6' },
  { name: 'Slate',   fill: '#F1F5F9',  stroke: '#475569',  ring: '#475569' },
  { name: 'Red',     fill: '#FEE2E2',  stroke: '#DC2626',  ring: '#DC2626' },
  { name: 'Orange',  fill: '#FFEDD5',  stroke: '#EA580C',  ring: '#EA580C' },
  { name: 'Amber',   fill: '#FEF3C7',  stroke: '#D97706',  ring: '#D97706' },
  { name: 'Green',   fill: '#DCFCE7',  stroke: '#16A34A',  ring: '#16A34A' },
  { name: 'Teal',    fill: '#CCFBF1',  stroke: '#0D9488',  ring: '#0D9488' },
  { name: 'Blue',    fill: '#DBEAFE',  stroke: '#2563EB',  ring: '#2563EB' },
  { name: 'Indigo',  fill: '#E0E7FF',  stroke: '#4F46E5',  ring: '#4F46E5' },
  { name: 'Purple',  fill: '#F3E8FF',  stroke: '#9333EA',  ring: '#9333EA' },
  { name: 'Pink',    fill: '#FCE7F3',  stroke: '#DB2777',  ring: '#DB2777' },
];

const NODE_TYPES: NodeType[] = [
  'service', 'database', 'queue', 'gateway', 'frontend',
  'cache', 'auth', 'monitor', 'cdn', 'ml', 'external', 'shape', 'entity',
];

const STYLES: { id: 'solid' | 'dashed' | 'dotted'; label: string; preview: string }[] = [
  { id: 'solid',  label: 'Solid',  preview: '──' },
  { id: 'dashed', label: 'Dashed', preview: '╴ ╴' },
  { id: 'dotted', label: 'Dotted', preview: '· · ·' },
];

export function PropertiesPopup() {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const selectedConnectionId = useCanvasStore((s) => s.selectedConnectionId);
  const nodes = useCanvasStore((s) => s.nodes);
  const connections = useCanvasStore((s) => s.connections);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const updateConnection = useCanvasStore((s) => s.updateConnection);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const deleteConnection = useCanvasStore((s) => s.deleteConnection);
  const clearSelection = useCanvasStore((s) => s.clearSelection);

  const node = selectedIds.length === 1 ? nodes.find((n) => n.id === selectedIds[0]) : undefined;
  const connection = selectedConnectionId
    ? connections.find((c) => c.id === selectedConnectionId)
    : undefined;

  if (!node && !connection) return null;

  return (
    <div className="absolute top-16 right-4 z-30 w-72 bg-white border border-[var(--hairline)] rounded-xl shadow-xl flex flex-col max-h-[calc(100vh-120px)]">
      <div className="px-4 py-2.5 border-b border-[var(--hairline)] flex items-center justify-between">
        <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)]">
          {connection ? 'Connection' : node?.type === 'entity' ? 'Entity' : 'Node'}
        </div>
        <button
          onClick={clearSelection}
          className="p-0.5 rounded hover:bg-neutral-100 text-[var(--muted)]"
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {node && <NodeFields node={node} updateNode={updateNode} deleteNode={deleteNode} />}
        {connection && (
          <ConnectionFields
            connection={connection}
            updateConnection={updateConnection}
            deleteConnection={deleteConnection}
          />
        )}
      </div>
    </div>
  );
}

// ─── Node properties form ─────────────────────────────────────────────────

function NodeFields({
  node,
  updateNode,
  deleteNode,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any;
  updateNode: (id: string, patch: Record<string, unknown>) => void;
  deleteNode: (id: string) => void;
}) {
  const isEntity = node.type === 'entity';
  return (
    <div className="space-y-4">
      <Field label="Label">
        <Input value={node.label} onChange={(e) => updateNode(node.id, { label: e.target.value })} />
      </Field>

      {!isEntity && (
        <Field label="Description">
          <Textarea
            rows={2}
            value={node.desc ?? ''}
            onChange={(e) => updateNode(node.id, { desc: e.target.value })}
            placeholder="Optional"
          />
        </Field>
      )}

      <Field label="Type">
        <select
          value={node.type}
          onChange={(e) => updateNode(node.id, { type: e.target.value as NodeType })}
          className="h-9 w-full rounded-md border border-[var(--hairline)] bg-white px-2 text-sm capitalize"
        >
          {NODE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </Field>

      {!isEntity && (
        <Field label="Tech">
          <select
            value={node.techId ?? ''}
            onChange={(e) => updateNode(node.id, { techId: e.target.value || undefined })}
            className="h-9 w-full rounded-md border border-[var(--hairline)] bg-white px-2 text-sm"
          >
            <option value="">— None —</option>
            {TECH_CATALOG.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </Field>
      )}

      {isEntity && (
        <Field label="Fields">
          <div className="space-y-1.5">
            {((node.fields ?? []) as EntityField[]).map((f, i) => (
              <FieldRow
                key={i}
                field={f}
                onChange={(patch) => {
                  const fields = [...((node.fields ?? []) as EntityField[])];
                  fields[i] = { ...f, ...patch };
                  updateNode(node.id, { fields });
                }}
                onDelete={() => {
                  const fields = ((node.fields ?? []) as EntityField[]).filter((_, j) => j !== i);
                  updateNode(node.id, { fields });
                }}
              />
            ))}
            <button
              onClick={() => {
                const fields: EntityField[] = [
                  ...((node.fields ?? []) as EntityField[]),
                  { name: 'field', type: 'text' },
                ];
                updateNode(node.id, { fields });
              }}
              className="w-full inline-flex items-center justify-center gap-1 h-7 rounded-md border border-dashed border-[var(--hairline)] text-[10px] font-mono uppercase text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <Plus size={11} /> Add field
            </button>
          </div>
        </Field>
      )}

      <Field label="Color">
        <div className="flex flex-wrap gap-1.5">
          {COLOR_PALETTE.map((c) => {
            const active = (node.stroke ?? '') === (c.stroke ?? '');
            return (
              <button
                key={c.name}
                onClick={() => updateNode(node.id, { fill: c.fill, stroke: c.stroke })}
                title={c.name}
                className={clsx(
                  'w-6 h-6 rounded-md border-2 transition',
                  active ? 'border-[var(--foreground)] scale-110' : 'border-transparent hover:scale-105'
                )}
                style={{
                  backgroundColor: c.fill ?? '#FFFFFF',
                  boxShadow: `inset 0 0 0 1.5px ${c.ring}`,
                }}
              />
            );
          })}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="X">
          <Input type="number" value={Math.round(node.x)} onChange={(e) => updateNode(node.id, { x: Number(e.target.value) })} />
        </Field>
        <Field label="Y">
          <Input type="number" value={Math.round(node.y)} onChange={(e) => updateNode(node.id, { y: Number(e.target.value) })} />
        </Field>
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={() => updateNode(node.id, { locked: !node.locked })}
      >
        {node.locked ? <Unlock size={13} /> : <Lock size={13} />}
        {node.locked ? 'Unlock' : 'Lock'}
      </Button>

      <Button
        variant="danger"
        size="sm"
        className="w-full"
        disabled={node.locked}
        onClick={() => !node.locked && deleteNode(node.id)}
      >
        <Trash2 size={13} />
        Delete node
      </Button>
    </div>
  );
}

// ─── Connection properties form ───────────────────────────────────────────

function ConnectionFields({
  connection,
  updateConnection,
  deleteConnection,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: any;
  updateConnection: (id: string, patch: Record<string, unknown>) => void;
  deleteConnection: (id: string) => void;
}) {
  const currentStyle = connection.style ?? 'solid';
  return (
    <div className="space-y-4">
      <Field label="Label">
        <Input
          value={connection.label ?? ''}
          onChange={(e) => updateConnection(connection.id, { label: e.target.value })}
          placeholder="HTTP / Events / SQL"
        />
      </Field>

      <Field label="Style">
        <div className="grid grid-cols-3 gap-1.5">
          {STYLES.map((s) => {
            const active = currentStyle === s.id;
            return (
              <button
                key={s.id}
                onClick={() => updateConnection(connection.id, { style: s.id })}
                className={clsx(
                  'h-12 rounded-md border flex flex-col items-center justify-center gap-0.5 transition',
                  active
                    ? 'border-[var(--foreground)] bg-[var(--accent-soft)]'
                    : 'border-[var(--hairline)] hover:border-[var(--foreground)]'
                )}
              >
                <StylePreview style={s.id} />
                <span className="text-[9px] font-mono uppercase">{s.label}</span>
              </button>
            );
          })}
        </div>
      </Field>

      <Button
        variant="danger"
        size="sm"
        className="w-full"
        onClick={() => deleteConnection(connection.id)}
      >
        <Trash2 size={13} />
        Delete connection
      </Button>
    </div>
  );
}

function StylePreview({ style }: { style: 'solid' | 'dashed' | 'dotted' }) {
  return (
    <svg width="32" height="6">
      <line
        x1="2"
        y1="3"
        x2="30"
        y2="3"
        stroke="#0E0F10"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={style === 'dashed' ? '6 3' : style === 'dotted' ? '1 3' : undefined}
      />
    </svg>
  );
}

function FieldRow({
  field,
  onChange,
  onDelete,
}: {
  field: EntityField;
  onChange: (patch: Partial<EntityField>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-[var(--hairline)] bg-neutral-50 px-1.5 py-1">
      <button
        onClick={() => onChange({ pk: !field.pk, fk: false })}
        className={field.pk ? 'text-amber-600' : 'text-neutral-300 hover:text-amber-600'}
        title="Toggle primary key"
      >
        <Key size={10} />
      </button>
      <button
        onClick={() => onChange({ fk: !field.fk, pk: false })}
        className={field.fk ? 'text-blue-600' : 'text-neutral-300 hover:text-blue-600'}
        title="Toggle foreign key"
      >
        <Link2 size={10} />
      </button>
      <input
        value={field.name}
        onChange={(e) => onChange({ name: e.target.value })}
        className="flex-1 min-w-0 bg-transparent outline-none text-[11px] font-medium px-1"
        placeholder="name"
      />
      <input
        value={field.type}
        onChange={(e) => onChange({ type: e.target.value })}
        className="w-14 bg-transparent outline-none text-[10px] font-mono text-[var(--muted)] text-right"
        placeholder="type"
      />
      <button onClick={onDelete} className="text-neutral-300 hover:text-red-600 ml-1">
        <Trash2 size={10} />
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}
