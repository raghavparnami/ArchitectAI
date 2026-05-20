'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { Code2, Hexagon, LayoutDashboard, Settings, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { useDiagramsStore } from '@/stores/diagrams.store';

const NAV = [
  { href: '/dashboard', label: 'Architect',  icon: LayoutDashboard },
  { href: '/codescan',  label: 'CodeScan',  icon: Code2 },
  { href: '/settings',  label: 'Settings',  icon: Settings },
];

const PLAN_LIMIT = 3;

interface TopNavProps {
  /** Override the default brand → nav layout. Used by editor pages. */
  centerSlot?: ReactNode;
  /** Page-specific actions on the right side, before the user button. */
  rightSlot?: ReactNode;
}

export function TopNav({ centerSlot, rightSlot }: TopNavProps) {
  const pathname = usePathname();
  const diagrams = useDiagramsStore((s) => s.diagrams);
  const hasHydrated = useDiagramsStore((s) => s.hasHydrated);
  const used = hasHydrated ? diagrams.length : 0;

  return (
    <header className="h-14 border-b border-[var(--hairline)] bg-white flex items-center px-4 shrink-0">
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center gap-2 mr-6">
        <Hexagon size={20} className="text-[var(--accent)]" strokeWidth={2.5} />
        <span className="font-semibold tracking-tight hidden sm:inline">ArchitectAI</span>
      </Link>

      {/* Center: nav links OR custom slot (editor) */}
      <div className="flex-1 min-w-0 flex items-center gap-1">
        {centerSlot ?? (
          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm transition',
                    active
                      ? 'bg-[var(--foreground)] text-[var(--background)]'
                      : 'text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]'
                  )}
                >
                  <Icon size={14} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        {rightSlot}
        <Link
          href="/pricing"
          className="hidden md:inline-flex items-center gap-1.5 px-2.5 h-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-mono font-semibold uppercase tracking-wider hover:opacity-80"
          title={`Free plan · ${used}/${PLAN_LIMIT} diagrams`}
        >
          <Sparkles size={11} />
          {hasHydrated ? `${used}/${PLAN_LIMIT}` : 'Free'}
        </Link>
      </div>
    </header>
  );
}
