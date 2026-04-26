'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Hexagon,
  LayoutDashboard,
  Settings,
  Users,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useDiagramsStore } from '@/stores/diagrams.store';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/team',      label: 'Team',      icon: Users },
  { href: '/settings',  label: 'Settings',  icon: Settings },
];

const PLAN_LIMIT = 3;
const STORAGE_KEY = 'architectai-sidebar-collapsed';

export function Sidebar() {
  const pathname = usePathname();
  const diagrams = useDiagramsStore((s) => s.diagrams);
  const hasHydrated = useDiagramsStore((s) => s.hasHydrated);

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === '1') setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      }
      return next;
    });
  };

  const used = hasHydrated ? diagrams.length : 0;
  const pct = Math.min(100, (used / PLAN_LIMIT) * 100);
  const atLimit = used >= PLAN_LIMIT;

  if (collapsed) {
    return (
      <aside className="w-14 border-r border-[var(--hairline)] bg-white flex flex-col items-center shrink-0">
        <Link
          href="/dashboard"
          className="h-14 w-full flex items-center justify-center border-b border-[var(--hairline)]"
          title="ArchitectAI"
        >
          <Hexagon size={20} className="text-[var(--accent)]" strokeWidth={2.5} />
        </Link>
        <nav className="flex-1 py-3 space-y-1 w-full px-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={clsx(
                  'h-10 w-full inline-flex items-center justify-center rounded-md transition',
                  active
                    ? 'bg-[var(--foreground)] text-[var(--background)]'
                    : 'text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]'
                )}
              >
                <Icon size={16} />
              </Link>
            );
          })}
        </nav>
        <div className="pb-3 w-full px-2 space-y-2">
          <Link
            href="/pricing"
            title="See plans"
            className="h-10 w-full inline-flex items-center justify-center rounded-md text-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            <Sparkles size={15} />
          </Link>
          <button
            onClick={toggle}
            title="Expand sidebar"
            className="h-10 w-full inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:bg-neutral-100 hover:text-[var(--foreground)]"
          >
            <PanelLeftOpen size={15} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-56 border-r border-[var(--hairline)] bg-white flex flex-col shrink-0">
      <div className="px-5 h-14 border-b border-[var(--hairline)] flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Hexagon size={20} className="text-[var(--accent)]" strokeWidth={2.5} />
          <span className="font-semibold tracking-tight">ArchitectAI</span>
        </Link>
        <button
          onClick={toggle}
          title="Collapse sidebar"
          className="p-1 rounded text-[var(--muted)] hover:bg-neutral-100 hover:text-[var(--foreground)]"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition',
                active
                  ? 'bg-[var(--foreground)] text-[var(--background)]'
                  : 'text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]'
              )}
            >
              <Icon size={15} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <div className="rounded-lg border border-[var(--hairline)] bg-gradient-to-br from-[var(--accent-soft)] to-white p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--foreground)]">
              Free Plan
            </div>
            <Sparkles size={11} className="text-[var(--accent)]" />
          </div>
          <div className="text-[10px] text-[var(--muted)] font-mono mb-1.5">
            {hasHydrated ? `${used}/${PLAN_LIMIT}` : '—'} diagrams
          </div>
          <div className="h-1 bg-white/60 rounded-full overflow-hidden mb-2">
            <div
              className={clsx('h-full transition-all', atLimit ? 'bg-red-500' : 'bg-[var(--accent)]')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <Link
            href="/pricing"
            className="block text-center text-[10px] font-mono font-semibold text-[var(--accent)] hover:opacity-80"
          >
            See plans →
          </Link>
        </div>
      </div>
    </aside>
  );
}
