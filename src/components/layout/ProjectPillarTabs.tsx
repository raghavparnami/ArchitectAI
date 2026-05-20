'use client';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Hexagon, Code2, Database, Boxes } from 'lucide-react';

type Pillar = 'overview' | 'architect' | 'codescan' | 'integration';

const TABS: {
  id: Pillar;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hrefTemplate: (projectId: string) => string;
  disabled?: boolean;
}[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: Boxes,
    hrefTemplate: (id) => `/dashboard?project=${id}`,
  },
  {
    id: 'architect',
    label: 'Architect',
    icon: Hexagon,
    hrefTemplate: (id) => `/dashboard?project=${id}#architect`,
  },
  {
    id: 'codescan',
    label: 'CodeScan',
    icon: Code2,
    hrefTemplate: (id) => `/codescan/${id}`,
  },
  {
    id: 'integration',
    label: 'Integration',
    icon: Database,
    hrefTemplate: () => '#',
    disabled: true,
  },
];

export function ProjectPillarTabs({
  projectId,
  active,
}: {
  projectId: string;
  active: Pillar;
}) {
  return (
    <nav className="border-b border-neutral-200 bg-white px-6">
      <ul className="flex items-center gap-1 -mb-px">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          const Icon = tab.icon;
          const content = (
            <span
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition',
                isActive
                  ? 'border-neutral-900 text-neutral-900'
                  : tab.disabled
                  ? 'border-transparent text-neutral-300 cursor-not-allowed'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.disabled && (
                <span className="ml-1 text-[9px] uppercase tracking-wide bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded">
                  soon
                </span>
              )}
            </span>
          );
          return (
            <li key={tab.id}>
              {tab.disabled ? (
                content
              ) : (
                <Link href={tab.hrefTemplate(projectId)}>{content}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
