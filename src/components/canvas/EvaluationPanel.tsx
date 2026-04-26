'use client';
import { useState } from 'react';
import {
  X,
  Loader2,
  TrendingUp,
  Shield,
  DollarSign,
  Lock,
  Wrench,
  Zap,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas.store';
import { Button } from '@/components/ui/Button';
import { Wand2 } from 'lucide-react';

interface Dimension {
  name: string;
  score: number;
  rationale: string;
  findings: string[];
}

interface EvalResult {
  overallScore: number;
  summary: string;
  dimensions: Dimension[];
  risks: string[];
  recommendations: string[];
  estimatedMonthlyCost?: string;
}

const DIMENSION_ICONS: Record<string, typeof TrendingUp> = {
  Scalability: TrendingUp,
  Reliability: Shield,
  'Cost Efficiency': DollarSign,
  Security: Lock,
  Maintainability: Wrench,
  Performance: Zap,
};

interface EvaluationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function EvaluationPanel({ open, onClose }: EvaluationPanelProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const connections = useCanvasStore((s) => s.connections);
  const loadVersion = useCanvasStore((s) => s.loadVersion);

  const [busy, setBusy] = useState(false);
  const [improving, setImproving] = useState(false);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState('');

  const applyTopFixes = async () => {
    if (!result || improving) return;
    setImproving(true);
    setError(null);
    try {
      const top3 = result.recommendations.slice(0, 3);
      const res = await fetch('/api/ai/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, connections, recommendations: top3 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Improve failed');
      }
      const data = await res.json();
      loadVersion(data.nodes, data.connections, [], []);
      setResult(null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Improve failed');
    } finally {
      setImproving(false);
    }
  };

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemStatement: problem, nodes, connections }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Evaluation failed');
      }
      const data: EvalResult = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex justify-end pointer-events-none">
      <div
        className="absolute inset-0 bg-black/20 pointer-events-auto"
        onClick={onClose}
      />
      <aside className="relative w-[480px] max-w-full bg-white border-l border-[var(--hairline)] shadow-2xl flex flex-col pointer-events-auto">
        <header className="px-5 py-4 border-b border-[var(--hairline)] flex items-center justify-between shrink-0">
          <div>
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
              AI Review
            </div>
            <h2 className="font-display text-2xl">Architecture Evaluation</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-neutral-100 text-[var(--muted)]"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {!result && (
            <div className="p-5 space-y-4">
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Gemini will score this diagram across 6 dimensions (scalability, reliability,
                cost, security, maintainability, performance) and give specific recommendations.
              </p>
              <div>
                <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                  Problem context (optional)
                </div>
                <textarea
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  placeholder="What is this system supposed to do? Expected scale? Any constraints?"
                  rows={4}
                  className="w-full rounded-md border border-[var(--hairline)] bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] resize-y"
                />
              </div>
              <Button onClick={run} disabled={busy || nodes.length === 0} className="w-full">
                {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                {busy ? 'Evaluating…' : 'Run evaluation'}
              </Button>
              {nodes.length === 0 && (
                <p className="text-[11px] text-[var(--muted)] text-center">
                  Add nodes to the canvas first.
                </p>
              )}
              {error && <div className="text-xs text-red-600">{error}</div>}
            </div>
          )}

          {result && (
            <div className="p-5 space-y-6">
              {/* Overall score */}
              <div className="text-center">
                <div className="font-display text-7xl leading-none">
                  <span className="text-[var(--foreground)]">{result.overallScore.toFixed(1)}</span>
                  <span className="text-2xl text-[var(--muted)] ml-1">/ 10</span>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] mt-1">
                  Overall score
                </div>
                <p className="text-xs text-[var(--foreground)] mt-3 leading-relaxed">
                  {result.summary}
                </p>
                {result.estimatedMonthlyCost && (
                  <div className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-[var(--accent-soft)] text-[10px] font-mono text-[var(--accent)]">
                    <DollarSign size={10} />
                    {result.estimatedMonthlyCost}
                  </div>
                )}
              </div>

              {/* Dimensions */}
              <section>
                <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
                  Dimensions
                </div>
                <div className="space-y-3">
                  {result.dimensions.map((d) => {
                    const Icon = DIMENSION_ICONS[d.name] ?? TrendingUp;
                    return (
                      <div
                        key={d.name}
                        className="rounded-lg border border-[var(--hairline)] bg-white p-3"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Icon size={13} className="text-[var(--accent)]" />
                            <span className="text-xs font-semibold">{d.name}</span>
                          </div>
                          <ScoreChip score={d.score} />
                        </div>
                        <p className="text-[11px] text-[var(--muted)] leading-relaxed mb-2">
                          {d.rationale}
                        </p>
                        <ul className="space-y-1">
                          {d.findings.map((f, i) => (
                            <li
                              key={i}
                              className="text-[11px] text-[var(--foreground)] pl-3 relative leading-snug"
                            >
                              <span className="absolute left-0 top-1 w-1 h-1 rounded-full bg-[var(--accent)]" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Risks */}
              {result.risks.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle size={12} className="text-red-500" />
                    <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)]">
                      Risks
                    </div>
                  </div>
                  <ol className="space-y-1.5">
                    {result.risks.map((r, i) => (
                      <li
                        key={i}
                        className="text-xs text-[var(--foreground)] pl-6 relative leading-snug"
                      >
                        <span className="absolute left-0 top-0 w-4 h-4 rounded bg-red-50 text-red-600 text-[9px] font-mono font-bold inline-flex items-center justify-center">
                          {i + 1}
                        </span>
                        {r}
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Lightbulb size={12} className="text-[var(--accent)]" />
                    <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)]">
                      Recommendations
                    </div>
                  </div>
                  <ol className="space-y-1.5">
                    {result.recommendations.map((r, i) => (
                      <li
                        key={i}
                        className="text-xs text-[var(--foreground)] pl-6 relative leading-snug"
                      >
                        <span className="absolute left-0 top-0 w-4 h-4 rounded bg-[var(--accent-soft)] text-[var(--accent)] text-[9px] font-mono font-bold inline-flex items-center justify-center">
                          {i + 1}
                        </span>
                        {r}
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <div className="space-y-2">
                <Button
                  size="sm"
                  className="w-full"
                  disabled={improving || result.recommendations.length === 0}
                  onClick={applyTopFixes}
                >
                  {improving ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                  {improving ? 'Applying…' : 'Apply top 3 fixes'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => { setResult(null); setError(null); }}
                >
                  Re-evaluate
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function ScoreChip({ score }: { score: number }) {
  const color =
    score >= 8 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : score >= 6 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-700 border-red-200';
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-mono font-bold tabular-nums ${color}`}
    >
      {score.toFixed(1)} / 10
    </span>
  );
}
