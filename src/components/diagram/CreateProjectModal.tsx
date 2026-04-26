'use client';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { clsx } from 'clsx';

const COLORS = [
  '#C7521B', '#3B82F6', '#10B981', '#F59E0B',
  '#A855F7', '#EC4899', '#0EA5E9', '#6B7280',
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateProjectModal({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const createProject = useDiagramsStore((s) => s.createProject);

  const submit = () => {
    if (!name.trim()) return;
    createProject(name.trim(), color);
    setName('');
    setColor(COLORS[0]);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="sm" title="New project">
      <div className="px-6 py-5 space-y-4">
        <div>
          <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
            Project name
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Payments Platform"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        <div>
          <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
            Color
          </div>
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={clsx(
                  'w-7 h-7 rounded-full border-2 transition',
                  color === c ? 'border-[var(--foreground)] scale-110' : 'border-transparent'
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="px-6 py-3 border-t border-[var(--hairline)] bg-neutral-50 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={submit} disabled={!name.trim()}>Create project</Button>
      </div>
    </Modal>
  );
}
