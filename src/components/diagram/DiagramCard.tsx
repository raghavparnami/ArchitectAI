'use client';
import Link from 'next/link';
import { Diagram } from '@/lib/types';
import { getTech } from '@/lib/tech-catalog';
import { StatusBadge } from './StatusBadge';

interface DiagramCardProps {
  diagram: Diagram;
}

export function DiagramCard({ diagram }: DiagramCardProps) {
  const techs = diagram.techIds.slice(0, 5).map((id) => getTech(id)).filter(Boolean);
  const overflow = Math.max(0, diagram.techIds.length - 3);

  return (
    <Link
      href={`/diagram/${diagram.id}`}
      className="block group rounded-xl border border-neutral-200 bg-white p-4 hover:border-neutral-400 hover:-translate-y-0.5 transition shadow-sm"
    >
      {/* Mini preview SVG */}
      <div className="h-20 bg-neutral-50 rounded-md border border-neutral-100 relative overflow-hidden mb-3">
        <svg width="100%" height="100%" viewBox="0 0 240 80">
          {techs.map((t, i) => {
            if (!t) return null;
            const x = 16 + i * 44;
            const y = 28;
            return (
              <g key={t.id}>
                {i > 0 && (
                  <line
                    x1={x - 28}
                    y1={y + 12}
                    x2={x}
                    y2={y + 12}
                    stroke="#CBD5E1"
                    strokeWidth={1}
                    markerEnd="url(#mini-arrow)"
                  />
                )}
                <rect
                  x={x}
                  y={y}
                  width={24}
                  height={24}
                  rx={5}
                  fill={`${t.color}22`}
                  stroke={`${t.color}88`}
                />
                <text
                  x={x + 12}
                  y={y + 16}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="ui-monospace, monospace"
                  fontWeight="700"
                  fill={t.color}
                >
                  {t.abbr}
                </text>
              </g>
            );
          })}
          <defs>
            <marker id="mini-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#CBD5E1" />
            </marker>
          </defs>
        </svg>
      </div>

      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold truncate flex-1">{diagram.title}</h3>
        <StatusBadge status={diagram.status} />
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        {diagram.techIds.slice(0, 3).map((id) => {
          const t = getTech(id);
          if (!t) return null;
          return (
            <span
              key={id}
              className="w-5 h-5 rounded inline-flex items-center justify-center font-mono font-bold text-[8px] border"
              style={{
                backgroundColor: `${t.color}22`,
                borderColor: `${t.color}88`,
                color: t.color,
              }}
            >
              {t.abbr}
            </span>
          );
        })}
        {overflow > 0 && (
          <span className="text-[10px] text-neutral-500 font-mono">+{overflow}</span>
        )}
      </div>

      <div className="text-[10px] text-neutral-400 font-mono">
        Updated {timeAgo(diagram.updatedAt)}
      </div>
    </Link>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}
