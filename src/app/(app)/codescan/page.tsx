'use client';
import { useState } from 'react';
import Link from 'next/link';
import { TopNav } from '@/components/layout/TopNav';
import { Button } from '@/components/ui/Button';
import { trpc } from '@/lib/trpc/client';
import { Code2, FolderPlus, Plus } from 'lucide-react';

export default function CodeScanIndexPage() {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const projectsQ = trpc.projects.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setCreating(false);
      setName('');
    },
  });

  const projects = projectsQ.data ?? [];

  return (
    <>
      <TopNav />
      <main className="flex-1 overflow-y-auto bg-paper">
        <div className="max-w-5xl mx-auto px-8 py-10">
          <div className="mb-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-neutral-500 mb-2">
              CodeScan++ · SQL Business Logic
            </div>
            <h1 className="font-display text-5xl leading-none">
              Pick a <span className="font-display-italic">project</span>
            </h1>
            <p className="mt-3 text-sm text-neutral-600 max-w-xl">
              CodeScan parses SQL, scores business-logic placement, and files
              findings against a project. Results are deduped by content hash so
              re-running on the same SQL won't double-record.
            </p>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl">Projects</h2>
            {!creating && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <FolderPlus size={14} />
                New project
              </Button>
            )}
          </div>

          {creating && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 mb-4 flex items-center gap-2">
              <input
                autoFocus
                placeholder="e.g. billing-svc"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 outline-none border-b border-neutral-200 px-1 py-1 text-sm focus:border-neutral-900"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) {
                    create.mutate({ name: name.trim() });
                  } else if (e.key === 'Escape') {
                    setCreating(false);
                  }
                }}
              />
              <Button
                size="sm"
                disabled={!name.trim() || create.isPending}
                onClick={() => create.mutate({ name: name.trim() })}
              >
                <Plus size={14} />
                Create
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCreating(false);
                  setName('');
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          {projectsQ.isLoading ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 p-12 text-center text-xs text-neutral-500">
              Loading…
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-neutral-200 p-12 text-center bg-white">
              <Code2
                size={36}
                className="text-neutral-700 mx-auto mb-4"
                strokeWidth={1.5}
              />
              <h3 className="font-display text-2xl mb-1">No projects yet</h3>
              <p className="text-sm text-neutral-500 mb-5">
                Create a project to scope your scans, findings, and history.
              </p>
              {!creating && (
                <Button onClick={() => setCreating(true)}>
                  Create your first project
                </Button>
              )}
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/codescan/${p.id}`}
                    className="block rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-900 transition"
                  >
                    <div className="text-xs font-mono text-neutral-500">
                      {p.id.slice(0, 16)}
                    </div>
                    <div className="font-medium mt-1">{p.name}</div>
                    {p.problemStatement && (
                      <div className="text-xs text-neutral-500 mt-1 line-clamp-2">
                        {p.problemStatement}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
