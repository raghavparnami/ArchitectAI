'use client';
import { DiagramStatus } from '@/lib/types';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';

const STAGES: { id: DiagramStatus; label: string }[] = [
  { id: 'draft',    label: 'Draft' },
  { id: 'review',   label: 'In Review' },
  { id: 'approved', label: 'Approved' },
];

export function WorkflowBar({ status }: { status: DiagramStatus }) {
  const currentIdx = status === 'rejected' ? 1 : STAGES.findIndex((s) => s.id === status);

  return (
    <div className="flex items-center w-full">
      {STAGES.map((stage, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const isReject = status === 'rejected' && stage.id === 'review';
        return (
          <div key={stage.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className={clsx(
                  'w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-bold border-2',
                  done && 'bg-emerald-500 border-emerald-500 text-white',
                  active && !isReject && 'bg-amber-500 border-amber-500 text-white',
                  isReject && 'bg-red-500 border-red-500 text-white',
                  !done && !active && !isReject && 'bg-white border-neutral-300 text-neutral-400'
                )}
              >
                {done ? <Check size={12} /> : i + 1}
              </div>
              <span
                className={clsx(
                  'text-[11px] font-mono font-semibold uppercase',
                  done || active ? 'text-neutral-900' : 'text-neutral-400'
                )}
              >
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={clsx(
                  'flex-1 h-0.5 mx-3',
                  done ? 'bg-emerald-500' : 'bg-neutral-200'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
