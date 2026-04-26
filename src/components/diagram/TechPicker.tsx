'use client';
import { TECH_BY_CATEGORY, CATEGORY_LABELS } from '@/lib/tech-catalog';
import { clsx } from 'clsx';

interface TechPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function TechPicker({ selected, onChange }: TechPickerProps) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  };

  return (
    <div className="space-y-5">
      {Object.entries(TECH_BY_CATEGORY).map(([cat, items]) => (
        <div key={cat}>
          <div className="text-[10px] font-mono font-semibold uppercase tracking-wide text-neutral-500 mb-2">
            {CATEGORY_LABELS[cat]}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {items.map((t) => {
              const active = selected.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition',
                    active
                      ? 'border-neutral-900 bg-neutral-50'
                      : 'border-neutral-200 bg-white hover:border-neutral-400'
                  )}
                  style={
                    active
                      ? { borderColor: t.color, backgroundColor: `${t.color}10` }
                      : undefined
                  }
                >
                  <span
                    className="w-4 h-4 rounded inline-flex items-center justify-center font-mono font-bold text-[8px] border"
                    style={{
                      backgroundColor: `${t.color}22`,
                      borderColor: `${t.color}88`,
                      color: t.color,
                    }}
                  >
                    {t.abbr}
                  </span>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
