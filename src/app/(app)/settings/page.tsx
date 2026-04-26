'use client';
import { useState } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { Button } from '@/components/ui/Button';
import {
  CreditCard,
  Database,
  ArrowUpRight,
  Trash2,
  AlertTriangle,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { useDiagramsStore } from '@/stores/diagrams.store';

const NAV_SECTIONS = [
  { id: 'billing',   label: 'Plan & Billing', icon: CreditCard },
  { id: 'workspace', label: 'Workspace data', icon: Database },
] as const;

type SectionId = typeof NAV_SECTIONS[number]['id'];

export default function SettingsPage() {
  const [section, setSection] = useState<SectionId>('billing');

  return (
    <>
      <TopNav />
      <div className="flex-1 overflow-y-auto bg-paper">
        <div className="max-w-5xl mx-auto px-10 py-12">
          <div className="mb-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--muted)] mb-2">
              Workspace · Configuration
            </div>
            <h1 className="font-display text-5xl leading-none">Settings</h1>
          </div>

          <div className="flex gap-12">
            <nav className="w-48 shrink-0">
              <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--muted)] mb-3 px-2">
                Sections
              </div>
              <div className="space-y-0.5">
                {NAV_SECTIONS.map((s) => {
                  const Icon = s.icon;
                  const active = section === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSection(s.id)}
                      className={clsx(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition text-left',
                        active
                          ? 'bg-[var(--foreground)] text-[var(--background)]'
                          : 'text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]'
                      )}
                    >
                      <Icon size={13} strokeWidth={1.75} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </nav>

            <div className="flex-1 min-w-0">
              <div className="mb-8 pb-5 border-b border-[var(--hairline)]">
                <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--muted)] mb-1">
                  Section
                </div>
                <h2 className="font-display text-3xl">
                  {NAV_SECTIONS.find((s) => s.id === section)!.label}
                </h2>
              </div>

              {section === 'billing' && <BillingSection />}
              {section === 'workspace' && <WorkspaceSection />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Billing section ──────────────────────────────────────────────────────

function BillingSection() {
  const diagrams = useDiagramsStore((s) => s.diagrams);
  const used = diagrams.length;
  const limit = 3;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--hairline)] bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
              Current plan
            </div>
            <div className="font-display text-3xl mb-1">Free</div>
            <div className="text-xs text-[var(--muted)]">
              {used}/{limit} diagrams used
            </div>
          </div>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-md bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90"
          >
            Upgrade
            <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="mt-4 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full transition-all',
              used >= limit ? 'bg-red-500' : 'bg-[var(--accent)]'
            )}
            style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
          />
        </div>
      </div>

      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2">
          What you get on Free
        </div>
        <ul className="rounded-xl border border-[var(--hairline)] bg-white divide-y divide-[var(--hairline)]">
          {[
            '3 diagrams',
            'AI generation, chat, evaluation, and import',
            '1 user',
            'localStorage persistence (this browser only)',
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 px-4 py-2.5 text-xs">
              <Check size={12} className="text-emerald-500 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <Link
        href="/pricing"
        className="block rounded-xl border border-dashed border-[var(--hairline)] p-5 text-center hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition group"
      >
        <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 group-hover:text-[var(--accent)]">
          Compare all plans
        </div>
        <div className="font-display text-xl">
          See pricing <span className="font-display-italic">→</span>
        </div>
      </Link>
    </div>
  );
}

// ─── Workspace data section ──────────────────────────────────────────────

function WorkspaceSection() {
  const diagrams = useDiagramsStore((s) => s.diagrams);
  const projects = useDiagramsStore((s) => s.projects);
  const deleteDiagram = useDiagramsStore((s) => s.deleteDiagram);
  const deleteProject = useDiagramsStore((s) => s.deleteProject);

  const clearAllDiagrams = () => {
    if (
      !confirm(
        `Permanently delete all ${diagrams.length} diagram${diagrams.length === 1 ? '' : 's'}? This cannot be undone.`
      )
    )
      return;
    diagrams.forEach((d) => deleteDiagram(d.id));
  };

  const clearAllProjects = () => {
    if (
      !confirm(
        `Permanently delete all ${projects.length} project${projects.length === 1 ? '' : 's'}? Diagrams in those projects will become Unassigned.`
      )
    )
      return;
    projects.forEach((p) => deleteProject(p.id));
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-[var(--muted)] leading-relaxed mb-4">
          Your diagrams and projects are stored locally in this browser&apos;s
          <span className="font-mono"> localStorage</span>. Use the actions below to
          export, clear, or wipe them. None of this data is currently synced to a
          server.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl border border-[var(--hairline)] bg-white p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
              Diagrams
            </div>
            <div className="font-display text-3xl tnum">{diagrams.length}</div>
          </div>
          <div className="rounded-xl border border-[var(--hairline)] bg-white p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
              Projects
            </div>
            <div className="font-display text-3xl tnum">{projects.length}</div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={13} className="text-red-600" />
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-red-600">
            Destructive actions
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-red-200 bg-red-50/40 p-5">
            <div className="text-sm font-semibold mb-1">Delete all diagrams</div>
            <p className="text-[11px] text-[var(--muted)] mb-3 leading-relaxed">
              Permanently removes every diagram in this browser. Cannot be undone.
            </p>
            <Button
              size="sm"
              variant="danger"
              disabled={diagrams.length === 0}
              onClick={clearAllDiagrams}
            >
              <Trash2 size={13} />
              Delete {diagrams.length} diagram{diagrams.length === 1 ? '' : 's'}
            </Button>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50/40 p-5">
            <div className="text-sm font-semibold mb-1">Delete all projects</div>
            <p className="text-[11px] text-[var(--muted)] mb-3 leading-relaxed">
              Removes all projects. Diagrams inside them will become Unassigned (not
              deleted).
            </p>
            <Button
              size="sm"
              variant="danger"
              disabled={projects.length === 0}
              onClick={clearAllProjects}
            >
              <Trash2 size={13} />
              Delete {projects.length} project{projects.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
