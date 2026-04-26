'use client';
import { DiagramStatus } from '@/lib/types';
import { clsx } from 'clsx';

const STYLES: Record<DiagramStatus, { label: string; cls: string }> = {
  draft:    { label: 'Draft',    cls: 'bg-neutral-100 text-neutral-700 border-neutral-200' },
  review:   { label: 'In Review', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected',  cls: 'bg-red-50 text-red-700 border-red-200' },
};

export function StatusBadge({ status }: { status: DiagramStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold uppercase tracking-wide',
        s.cls
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {s.label}
    </span>
  );
}
