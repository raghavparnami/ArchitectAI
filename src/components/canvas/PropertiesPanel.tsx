'use client';
import { useCanvasStore } from '@/stores/canvas.store';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { NodeType, EntityField } from '@/lib/types';
import { TECH_CATALOG } from '@/lib/tech-catalog';
import { Trash2, Plus, ChevronRight, Settings2, Key, Link2, Lock, Unlock } from 'lucide-react';

const NODE_TYPES: NodeType[] = [
  'service', 'database', 'queue', 'gateway', 'frontend',
  'cache', 'auth', 'monitor', 'cdn', 'ml', 'external', 'shape', 'entity',
];

interface PropertiesPanelProps {
  open?: boolean;
  onToggle?: () => void;
}

export function PropertiesPanel({ open = true, onToggle }: PropertiesPanelProps) {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const deleteNode = useCanvasStore((s) => s.deleteNode);

  const node = selectedIds.length === 1
    ? nodes.find((n) => n.id === selectedIds[0])
    : undefined;

  if (!open) {
    return (
      <aside className="w-9 border-l border-[var(--hairline)] bg-white flex flex-col items-center pt-3 shrink-0">
        <button
          onClick={onToggle}
          className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]"
          title="Show properties"
        >
          <Settings2 size={14} />
        </button>
      </aside>
    );
  }

  const isEntity = node?.type === 'entity';

  return (
    <aside className="w-64 border-l border-[var(--hairline)] bg-white flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-[var(--hairline)] flex items-center justify-between">
        <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)]">
          Properties
        </div>
        {onToggle && (
          <button
            onClick={onToggle}
            className="p-0.5 rounded hover:bg-neutral-100 text-[var(--muted)]"
            title="Collapse properties"
          >
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!node ? (
          <div className="text-center text-xs text-[var(--muted)] py-8 leading-relaxed">
            {selectedIds.length === 0
              ? 'Select a node to edit'
              : `${selectedIds.length} nodes selected`}
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Label">
              <Input
                value={node.label}
                onChange={(e) => updateNode(node.id, { label: e.target.value })}
              />
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
                  onChange={(e) =>
                    updateNode(node.id, { techId: e.target.value || undefined })
                  }
                  className="h-9 w-full rounded-md border border-[var(--hairline)] bg-white px-2 text-sm"
                >
                  <option value="">— None —</option>
                  {TECH_CATALOG.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </Field>
            )}

            {/* Entity fields editor */}
            {isEntity && (
              <Field label="Fields">
                <div className="space-y-1.5">
                  {(node.fields ?? []).map((f, i) => (
                    <FieldRow
                      key={i}
                      field={f}
                      onChange={(patch) => {
                        const fields = [...(node.fields ?? [])];
                        fields[i] = { ...f, ...patch };
                        updateNode(node.id, { fields });
                      }}
                      onDelete={() => {
                        const fields = (node.fields ?? []).filter((_, j) => j !== i);
                        updateNode(node.id, { fields });
                      }}
                    />
                  ))}
                  <button
                    onClick={() => {
                      const fields: EntityField[] = [
                        ...(node.fields ?? []),
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
              {node.locked ? 'Unlock node' : 'Lock node'}
            </Button>

            <Button
              variant="danger"
              size="sm"
              className="w-full"
              onClick={() => !node.locked && deleteNode(node.id)}
              disabled={node.locked}
            >
              <Trash2 size={13} />
              Delete node
            </Button>
          </div>
        )}
      </div>
    </aside>
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
      <button
        onClick={onDelete}
        className="text-neutral-300 hover:text-red-600 ml-1"
        title="Delete field"
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}
