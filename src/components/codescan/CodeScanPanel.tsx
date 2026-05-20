'use client';
import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/Button';
import { SeverityBadge, StatusBadge } from './SeverityBadge';
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  FileWarning,
  PlayCircle,
  Trash2,
  Upload,
} from 'lucide-react';

type FileSlot = { id: string; label: string; sql: string };

const newSlot = (): FileSlot => ({
  id: Math.random().toString(36).slice(2),
  label: 'pasted.sql',
  sql: '',
});

export function CodeScanPanel({ projectId }: { projectId: string }) {
  const [slots, setSlots] = useState<FileSlot[]>([newSlot()]);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    null
  );

  const utils = trpc.useUtils();
  const findingsQ = trpc.codescan.listFindings.useQuery({
    projectId,
    pillar: 'codescan',
  });
  const scansQ = trpc.codescan.listScans.useQuery({ projectId });

  const runScan = trpc.codescan.runSqlScan.useMutation({
    onSuccess: () => {
      utils.codescan.listFindings.invalidate({
        projectId,
        pillar: 'codescan',
      });
      utils.codescan.listScans.invalidate({ projectId });
    },
  });
  const setStatus = trpc.codescan.setStatus.useMutation({
    onSuccess: () => {
      utils.codescan.listFindings.invalidate({
        projectId,
        pillar: 'codescan',
      });
      if (selectedFindingId) {
        utils.codescan.findingById.invalidate({ id: selectedFindingId });
      }
    },
  });

  const findings = findingsQ.data ?? [];
  const scans = scansQ.data ?? [];
  const selected = useMemo(
    () => findings.find((f) => f.id === selectedFindingId) ?? null,
    [findings, selectedFindingId]
  );

  const handleRun = () => {
    const usable = slots.filter((s) => s.sql.trim().length > 0);
    if (usable.length === 0) return;
    runScan.mutate({
      projectId,
      label: `Scan of ${usable.length} file${usable.length > 1 ? 's' : ''}`,
      files: usable.map(({ label, sql }) => ({ label, sql })),
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    const additions: FileSlot[] = [];
    for (const file of Array.from(fileList)) {
      const text = await file.text();
      additions.push({
        id: Math.random().toString(36).slice(2),
        label: file.name,
        sql: text.slice(0, 200_000),
      });
    }
    setSlots((prev) => {
      const next = prev.filter((s) => s.sql.trim().length > 0);
      return [...next, ...additions];
    });
    e.target.value = '';
  };

  return (
    <div className="grid grid-cols-12 gap-4 h-full">
      {/* ─── Left: input + scan history ─── */}
      <div className="col-span-5 flex flex-col gap-4 overflow-y-auto pr-2">
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Code2 className="h-4 w-4" /> SQL inputs
            </h3>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer text-xs text-neutral-600 hover:text-neutral-900 inline-flex items-center gap-1">
                <Upload className="h-3.5 w-3.5" />
                Upload .sql
                <input
                  type="file"
                  accept=".sql,text/plain"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                />
              </label>
              <button
                className="text-xs text-neutral-600 hover:text-neutral-900"
                onClick={() => setSlots((p) => [...p, newSlot()])}
              >
                + paste
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {slots.map((slot, i) => (
              <div
                key={slot.id}
                className="border border-neutral-200 rounded-md overflow-hidden"
              >
                <div className="flex items-center gap-2 px-2 py-1 bg-neutral-50 border-b border-neutral-200">
                  <input
                    className="text-xs font-mono bg-transparent flex-1 outline-none"
                    value={slot.label}
                    onChange={(e) =>
                      setSlots((prev) =>
                        prev.map((s) =>
                          s.id === slot.id ? { ...s, label: e.target.value } : s
                        )
                      )
                    }
                  />
                  {slots.length > 1 && (
                    <button
                      className="text-neutral-400 hover:text-red-600"
                      onClick={() =>
                        setSlots((prev) => prev.filter((s) => s.id !== slot.id))
                      }
                      aria-label={`remove ${slot.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <textarea
                  className="w-full min-h-[120px] p-2 font-mono text-xs outline-none resize-y"
                  placeholder="Paste SQL (SELECT, view, stored proc body, dbt model)…"
                  value={slot.sql}
                  onChange={(e) =>
                    setSlots((prev) =>
                      prev.map((s) =>
                        s.id === slot.id ? { ...s, sql: e.target.value } : s
                      )
                    )
                  }
                />
                <div className="text-[10px] text-neutral-400 px-2 py-1 border-t border-neutral-100">
                  #{i + 1} · {slot.sql.length.toLocaleString()} chars
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              {runScan.isPending
                ? 'Scoring…'
                : runScan.error
                ? `Error: ${runScan.error.message}`
                : runScan.data
                ? `Last scan: ${runScan.data.totalFindings} finding${
                    runScan.data.totalFindings === 1 ? '' : 's'
                  }`
                : 'Ready'}
            </span>
            <Button
              variant="primary"
              size="sm"
              disabled={
                runScan.isPending ||
                slots.every((s) => s.sql.trim().length === 0)
              }
              onClick={handleRun}
            >
              <PlayCircle className="h-4 w-4" />
              Run scan
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="text-sm font-semibold mb-3">Scan history</h3>
          {scans.length === 0 ? (
            <p className="text-xs text-neutral-500">
              No scans yet. Run one above.
            </p>
          ) : (
            <ul className="space-y-2">
              {scans.map((s) => (
                <li
                  key={s.id}
                  className="text-xs flex items-center justify-between"
                >
                  <span className="font-mono">
                    {s.label ?? s.id.slice(0, 12)}
                  </span>
                  <span className="text-neutral-500">
                    {s.status === 'succeeded' ? (
                      <CheckCircle2 className="inline h-3 w-3 text-emerald-600" />
                    ) : s.status === 'failed' ? (
                      <AlertCircle className="inline h-3 w-3 text-red-600" />
                    ) : (
                      <span>…</span>
                    )}{' '}
                    {s.summary
                      ? `${s.summary.totalFindings} findings`
                      : s.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ─── Middle: findings list ─── */}
      <div className="col-span-3 overflow-y-auto pr-2">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <FileWarning className="h-4 w-4" />
          Findings
          <span className="text-neutral-500 font-normal">
            ({findings.length})
          </span>
        </h3>
        {findings.length === 0 ? (
          <p className="text-xs text-neutral-500">
            Scan some SQL to populate findings.
          </p>
        ) : (
          <ul className="space-y-2">
            {findings.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => setSelectedFindingId(f.id)}
                  className={`w-full text-left rounded-md border p-2 transition ${
                    selectedFindingId === f.id
                      ? 'border-neutral-900 bg-neutral-50'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={f.severity} />
                    <StatusBadge status={f.status} />
                    {f.score !== null && f.score !== undefined && (
                      <span className="text-[10px] text-neutral-500 font-mono ml-auto">
                        {f.score}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-medium leading-snug line-clamp-2">
                    {f.title}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ─── Right: detail ─── */}
      <div className="col-span-4 overflow-y-auto pl-2 border-l border-neutral-200">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-xs text-neutral-500">
            Select a finding to view details.
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <SeverityBadge severity={selected.severity} />
                <StatusBadge status={selected.status} />
                <span className="text-[10px] text-neutral-500 font-mono">
                  {selected.category}
                </span>
              </div>
              <h2 className="text-sm font-semibold leading-snug">
                {selected.title}
              </h2>
            </div>

            <div className="rounded-md border border-neutral-200 p-3 bg-white">
              <h4 className="text-xs font-semibold mb-2 text-neutral-700">
                Description
              </h4>
              <pre className="whitespace-pre-wrap text-xs text-neutral-700 font-sans">
                {selected.descriptionMd}
              </pre>
            </div>

            {selected.suggestedFixMd && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-3">
                <h4 className="text-xs font-semibold mb-2 text-emerald-800">
                  Suggested fix
                </h4>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  {selected.suggestedFixMd}
                </p>
              </div>
            )}

            {(selected.evidence ?? []).map((ev, i) => (
              <div
                key={i}
                className="rounded-md border border-neutral-200 bg-neutral-50 overflow-hidden"
              >
                <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-neutral-600 border-b border-neutral-200 bg-white">
                  Evidence · {ev.type}
                  {ev.type === 'sql' && ev.sourceLabel
                    ? ` · ${ev.sourceLabel}`
                    : ''}
                </div>
                {ev.type === 'sql' ? (
                  <pre className="text-[11px] font-mono p-3 overflow-x-auto whitespace-pre">
                    {ev.sql}
                  </pre>
                ) : ev.type === 'note' ? (
                  <p className="text-xs p-3 text-neutral-700">{ev.text}</p>
                ) : ev.type === 'code' ? (
                  <pre className="text-[11px] font-mono p-3 overflow-x-auto whitespace-pre">
                    {ev.snippet}
                  </pre>
                ) : (
                  <pre className="text-[11px] font-mono p-3 overflow-x-auto whitespace-pre">
                    {JSON.stringify(ev, null, 2)}
                  </pre>
                )}
              </div>
            ))}

            <div className="rounded-md border border-neutral-200 p-3 bg-white">
              <h4 className="text-xs font-semibold mb-2">Status</h4>
              <div className="flex flex-wrap gap-2">
                {(['open', 'acknowledged', 'fixed', 'wont_fix'] as const).map(
                  (s) => (
                    <button
                      key={s}
                      disabled={
                        setStatus.isPending || selected.status === s
                      }
                      onClick={() =>
                        setStatus.mutate({ id: selected.id, status: s })
                      }
                      className={`text-xs px-2 py-1 rounded border transition ${
                        selected.status === s
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white border-neutral-300 hover:border-neutral-500'
                      }`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
