'use client';
import { useState } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import { CreateDiagramModal } from '@/components/diagram/CreateDiagramModal';
import { CreateProjectModal } from '@/components/diagram/CreateProjectModal';
import { DiagramCard } from '@/components/diagram/DiagramCard';
import { Hexagon, FileText, Eye, CheckCircle2, FolderPlus, Folder } from 'lucide-react';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { DiagramStatus } from '@/lib/types';
import { clsx } from 'clsx';

const FILTERS: { id: 'all' | DiagramStatus; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'draft',    label: 'Drafts' },
  { id: 'review',   label: 'In Review' },
  { id: 'approved', label: 'Approved' },
];

export default function DashboardPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | DiagramStatus>('all');
  const [activeProject, setActiveProject] = useState<string | 'all' | 'unassigned'>('all');

  const diagrams = useDiagramsStore((s) => s.diagrams);
  const projects = useDiagramsStore((s) => s.projects);
  const hasHydrated = useDiagramsStore((s) => s.hasHydrated);

  let filtered = diagrams;
  if (activeProject === 'unassigned') {
    filtered = filtered.filter((d) => !d.projectId);
  } else if (activeProject !== 'all') {
    filtered = filtered.filter((d) => d.projectId === activeProject);
  }
  if (filter !== 'all') {
    filtered = filtered.filter((d) => d.status === filter);
  }

  const stats = [
    { label: 'Total',     value: diagrams.length, icon: FileText },
    { label: 'Drafts',    value: diagrams.filter((d) => d.status === 'draft').length,    icon: FileText },
    { label: 'In Review', value: diagrams.filter((d) => d.status === 'review').length,   icon: Eye },
    { label: 'Approved',  value: diagrams.filter((d) => d.status === 'approved').length, icon: CheckCircle2 },
  ];

  return (
    <>
      <TopNav
        rightSlot={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            New diagram
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto bg-paper">
        <div className="max-w-6xl mx-auto px-8 py-10">
          {/* Editorial header */}
          <div className="mb-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--muted)] mb-2">
              Workspace · Overview
            </div>
            <h1 className="font-display text-5xl leading-none">
              Your <span className="font-display-italic">diagrams</span>
            </h1>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="rounded-xl border border-[var(--hairline)] bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted)]">
                      {s.label}
                    </div>
                    <Icon size={13} className="text-[var(--muted)]/40" />
                  </div>
                  <div className="font-display text-3xl mt-1 tnum">
                    {hasHydrated ? s.value : '—'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Projects bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)]">
                Projects
              </div>
              <button
                onClick={() => setProjectModalOpen(true)}
                className="inline-flex items-center gap-1 text-[10px] font-mono uppercase text-[var(--accent)] hover:opacity-70"
              >
                <FolderPlus size={11} />
                New project
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <ProjectChip
                label="All"
                count={diagrams.length}
                active={activeProject === 'all'}
                onClick={() => setActiveProject('all')}
              />
              <ProjectChip
                label="Unassigned"
                count={diagrams.filter((d) => !d.projectId).length}
                active={activeProject === 'unassigned'}
                onClick={() => setActiveProject('unassigned')}
              />
              {projects.map((p) => (
                <ProjectChip
                  key={p.id}
                  label={p.name}
                  count={diagrams.filter((d) => d.projectId === p.id).length}
                  active={activeProject === p.id}
                  color={p.color}
                  onClick={() => setActiveProject(p.id)}
                />
              ))}
            </div>
          </div>

          {/* Status filter + diagrams */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl">
              {activeProject === 'all'
                ? 'All diagrams'
                : activeProject === 'unassigned'
                ? 'Unassigned'
                : projects.find((p) => p.id === activeProject)?.name ?? 'Project'}
            </h2>
            <div className="flex items-center gap-1 bg-white border border-[var(--hairline)] rounded-md p-0.5">
              {FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={clsx(
                      'px-2.5 h-7 rounded text-[10px] font-mono font-semibold uppercase transition',
                      active
                        ? 'bg-[var(--foreground)] text-[var(--background)]'
                        : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {!hasHydrated ? (
            <div className="rounded-2xl border border-dashed border-[var(--hairline)] p-16 text-center text-xs text-[var(--muted)]">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            diagrams.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-[var(--hairline)] p-16 text-center bg-white">
                <Hexagon
                  size={42}
                  className="text-[var(--accent)] mx-auto mb-4"
                  strokeWidth={1.5}
                />
                <h3 className="font-display text-2xl mb-1">No diagrams yet</h3>
                <p className="text-sm text-[var(--muted)] mb-5">
                  Generate your first architecture diagram with AI
                </p>
                <Button onClick={() => setCreateOpen(true)}>
                  Create your first diagram
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--hairline)] p-12 text-center text-sm text-[var(--muted)]">
                No diagrams match the current filter
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((d) => (
                <DiagramCard key={d.id} diagram={d} />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateDiagramModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <CreateProjectModal open={projectModalOpen} onClose={() => setProjectModalOpen(false)} />
    </>
  );
}

function ProjectChip({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 h-8 rounded-full border text-xs font-medium transition',
        active
          ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]'
          : 'border-[var(--hairline)] bg-white text-[var(--foreground)] hover:border-[var(--foreground)]'
      )}
    >
      {color && (
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {!color && <Folder size={11} />}
      {label}
      <span className="text-[10px] tnum opacity-60">{count}</span>
    </button>
  );
}
