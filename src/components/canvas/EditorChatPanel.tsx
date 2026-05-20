'use client';
import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Loader2,
  Sparkles,
  RotateCcw,
  ChevronLeft,
  X,
  Hammer,
  ClipboardCheck,
  Wand2,
  TrendingUp,
  Shield,
  DollarSign,
  Lock,
  Wrench,
  Zap,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useCanvasStore } from '@/stores/canvas.store';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { ChatMessage, DiagramConnection, DiagramNode } from '@/lib/types';

type Tab = 'design' | 'review';

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

interface Props {
  diagramId: string;
  onClose: () => void;
  /** Controlled tab — design (chat to redesign) or review (run evaluation). */
  tab?: Tab;
  onTabChange?: (t: Tab) => void;
}

export function EditorChatPanel({ diagramId, onClose, tab, onTabChange }: Props) {
  const diagram = useDiagramsStore((s) => s.diagrams.find((d) => d.id === diagramId));
  const updateDiagram = useDiagramsStore((s) => s.updateDiagram);

  const nodes = useCanvasStore((s) => s.nodes);
  const connections = useCanvasStore((s) => s.connections);
  const groups = useCanvasStore((s) => s.groups);
  const strokes = useCanvasStore((s) => s.strokes);
  const loadVersion = useCanvasStore((s) => s.loadVersion);

  const messages: ChatMessage[] = diagram?.messages ?? [];

  // If parent isn't controlling the tab, manage it locally.
  const [localTab, setLocalTab] = useState<Tab>(tab ?? 'design');
  const activeTab = tab ?? localTab;
  const setActiveTab = (t: Tab) => {
    setLocalTab(t);
    onTabChange?.(t);
  };

  // Design (chat) state
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Review (evaluation) state
  const [evalBusy, setEvalBusy] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [problem, setProblem] = useState('');
  const [improving, setImproving] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setError(null);

    const userMsg: ChatMessage = {
      role: 'user',
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMsg];
    updateDiagram(diagramId, { messages: nextMessages });
    setInput('');
    setBusy(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          currentNodes: nodes,
          currentConnections: connections,
          mode: 'design',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Chat failed');
      }
      const data: {
        reply: string;
        nodes: DiagramNode[];
        connections: DiagramConnection[];
        suggestions: string[];
      } = await res.json();

      loadVersion(data.nodes, data.connections, groups, strokes);
      const finalMessages: ChatMessage[] = [
        ...nextMessages,
        {
          role: 'assistant',
          content: data.reply,
          createdAt: new Date().toISOString(),
        },
      ];
      updateDiagram(diagramId, {
        messages: finalMessages,
        nodes: data.nodes,
        connections: data.connections,
      });
      setSuggestions(data.suggestions || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const runEvaluation = async () => {
    if (evalBusy) return;
    if (nodes.length === 0) {
      setEvalError('Add nodes to the canvas first.');
      return;
    }
    setEvalBusy(true);
    setEvalError(null);
    try {
      const res = await fetch('/api/ai/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemStatement: problem || undefined,
          nodes,
          connections,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Evaluation failed');
      }
      const data: EvalResult = await res.json();
      setEvalResult(data);
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setEvalBusy(false);
    }
  };

  const applyTopFixes = async () => {
    if (!evalResult || improving) return;
    setImproving(true);
    setEvalError(null);
    try {
      const top3 = evalResult.recommendations.slice(0, 3);
      const res = await fetch('/api/ai/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, connections, recommendations: top3 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Improve failed');
      }
      const data: {
        nodes: DiagramNode[];
        connections: DiagramConnection[];
        changeSummary: string;
      } = await res.json();
      loadVersion(data.nodes, data.connections, groups, strokes);
      updateDiagram(diagramId, {
        nodes: data.nodes,
        connections: data.connections,
      });
      // Clear result so user can re-evaluate against the new design.
      setEvalResult(null);
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : 'Improve failed');
    } finally {
      setImproving(false);
    }
  };

  const restartChat = () => {
    if (!confirm('Clear the conversation? The diagram itself will not change.')) return;
    updateDiagram(diagramId, { messages: [] });
    setSuggestions([]);
    setError(null);
  };

  return (
    <aside className="w-96 border-r border-[var(--hairline)] bg-white flex flex-col shrink-0">
      <div className="px-3 h-10 border-b border-[var(--hairline)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-[var(--accent)]" />
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">
            AI
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {activeTab === 'design' && (
            <button
              onClick={restartChat}
              disabled={messages.length === 0}
              title="Clear conversation"
              className="p-1 rounded text-[var(--muted)] hover:bg-neutral-100 hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <RotateCcw size={11} />
            </button>
          )}
          <button
            onClick={onClose}
            title="Close panel"
            className="p-1 rounded text-[var(--muted)] hover:bg-neutral-100 hover:text-[var(--foreground)]"
          >
            <ChevronLeft size={12} />
          </button>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="px-3 pt-2.5 pb-2 border-b border-[var(--hairline)]">
        <div className="inline-flex p-0.5 rounded-lg bg-neutral-100 w-full">
          <TabPill
            icon={Hammer}
            label="Build"
            active={activeTab === 'design'}
            onClick={() => setActiveTab('design')}
          />
          <TabPill
            icon={ClipboardCheck}
            label="Review"
            active={activeTab === 'review'}
            onClick={() => setActiveTab('review')}
          />
        </div>
      </div>

      {activeTab === 'design' ? (
        <DesignBody
          messages={messages}
          busy={busy}
          suggestions={suggestions}
          error={error}
          input={input}
          setInput={setInput}
          send={send}
          scrollRef={scrollRef}
        />
      ) : (
        <ReviewBody
          problem={problem}
          setProblem={setProblem}
          busy={evalBusy}
          error={evalError}
          result={evalResult}
          improving={improving}
          nodeCount={nodes.length}
          onRun={runEvaluation}
          onReset={() => {
            setEvalResult(null);
            setEvalError(null);
          }}
          onApplyTopFixes={applyTopFixes}
        />
      )}
    </aside>
  );
}

function TabPill({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Hammer;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={clsx(
        'flex-1 inline-flex items-center justify-center gap-1.5 h-7 rounded-md text-[11px] font-medium transition',
        active
          ? 'bg-white text-[var(--foreground)] shadow-sm'
          : 'text-[var(--muted)] hover:text-[var(--foreground)]'
      )}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

// ─── Design (chat) tab ──────────────────────────────────────────────────────
function DesignBody({
  messages,
  busy,
  suggestions,
  error,
  input,
  setInput,
  send,
  scrollRef,
}: {
  messages: ChatMessage[];
  busy: boolean;
  suggestions: string[];
  error: string | null;
  input: string;
  setInput: (v: string) => void;
  send: (text: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="text-center pt-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] inline-flex items-center justify-center mb-2">
              <Sparkles size={16} className="text-[var(--accent)]" />
            </div>
            <h3 className="font-display text-lg mb-1">
              Refine with <span className="font-display-italic">AI</span>
            </h3>
            <p className="text-[10px] text-[var(--muted)] leading-relaxed mb-4 max-w-[220px] mx-auto">
              Tell the AI what to change. The diagram updates with each turn.
            </p>
            <div className="space-y-1">
              {[
                'Add Redis between API and DB',
                'Add a load balancer',
                'Switch to Kafka for async events',
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="block w-full text-left px-2 py-1.5 rounded border border-[var(--hairline)] bg-white hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40 text-[10px]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] rounded-xl rounded-tr-sm bg-[var(--foreground)] text-[var(--background)] px-2.5 py-1.5 text-[11px] leading-relaxed'
                      : 'max-w-[85%] rounded-xl rounded-tl-sm bg-[var(--accent-soft)] text-[var(--foreground)] px-2.5 py-1.5 text-[11px] leading-relaxed'
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-[var(--accent-soft)] text-[var(--foreground)] px-2.5 py-1.5 text-[11px] flex items-center gap-1.5">
                  <Loader2 size={10} className="animate-spin" />
                  Thinking…
                </div>
              </div>
            )}
            {suggestions.length > 0 && !busy && (
              <div className="pt-1">
                <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--muted)] mb-1">
                  Try
                </div>
                <div className="flex flex-wrap gap-1">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => send(s)}
                      className="text-[9px] px-1.5 py-0.5 rounded-full bg-white border border-[var(--hairline)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40 text-left max-w-full"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="px-3 pb-1.5 text-[10px] text-red-600 flex items-start gap-1">
          <X size={10} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-[var(--hairline)] p-2 flex items-center gap-1.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder="Ask AI to modify the architecture…"
          className="flex-1 h-8 bg-[var(--background)] border border-[var(--hairline)] rounded-md px-2.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 disabled:opacity-40"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        </button>
      </form>
    </>
  );
}

// ─── Review (evaluation) tab ────────────────────────────────────────────────
function ReviewBody({
  problem,
  setProblem,
  busy,
  error,
  result,
  improving,
  nodeCount,
  onRun,
  onReset,
  onApplyTopFixes,
}: {
  problem: string;
  setProblem: (v: string) => void;
  busy: boolean;
  error: string | null;
  result: EvalResult | null;
  improving: boolean;
  nodeCount: number;
  onRun: () => void;
  onReset: () => void;
  onApplyTopFixes: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      {!result && (
        <div className="p-3 space-y-3">
          <p className="text-[10.5px] text-[var(--muted)] leading-relaxed">
            DeepSeek will score this diagram across 6 dimensions and give
            specific recommendations.
          </p>
          <div>
            <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
              Problem context (optional)
            </div>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="What is this system supposed to do? Expected scale? Any constraints?"
              rows={4}
              className="w-full rounded-md border border-[var(--hairline)] bg-white px-2.5 py-2 text-[11px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] resize-y"
            />
          </div>
          <button
            onClick={onRun}
            disabled={busy || nodeCount === 0}
            className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--foreground)] text-[var(--background)] text-xs font-medium hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <ClipboardCheck size={12} />}
            {busy ? 'Evaluating…' : 'Run evaluation'}
          </button>
          {nodeCount === 0 && (
            <p className="text-[10px] text-[var(--muted)] text-center">
              Add nodes to the canvas first.
            </p>
          )}
          {error && <div className="text-[10.5px] text-red-600">{error}</div>}
        </div>
      )}

      {result && (
        <div className="p-3 space-y-5">
          {/* Overall score */}
          <div className="text-center">
            <div className="font-display text-6xl leading-none">
              <span className="text-[var(--foreground)]">{result.overallScore.toFixed(1)}</span>
              <span className="text-xl text-[var(--muted)] ml-1">/ 10</span>
            </div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--muted)] mt-1">
              Overall score
            </div>
            <p className="text-[11px] text-[var(--foreground)] mt-2.5 leading-relaxed">
              {result.summary}
            </p>
            {result.estimatedMonthlyCost && (
              <div className="inline-flex items-center gap-1.5 mt-2.5 px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[9.5px] font-mono text-[var(--accent)]">
                <DollarSign size={9} />
                {result.estimatedMonthlyCost}
              </div>
            )}
          </div>

          {/* Dimensions */}
          <section>
            <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
              Dimensions
            </div>
            <div className="space-y-2">
              {result.dimensions.map((d) => {
                const Icon = DIMENSION_ICONS[d.name] ?? TrendingUp;
                return (
                  <div
                    key={d.name}
                    className="rounded-md border border-[var(--hairline)] bg-white p-2.5"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Icon size={11} className="text-[var(--accent)]" />
                        <span className="text-[11px] font-semibold">{d.name}</span>
                      </div>
                      <ScoreChip score={d.score} />
                    </div>
                    <p className="text-[10px] text-[var(--muted)] leading-relaxed mb-1.5">
                      {d.rationale}
                    </p>
                    <ul className="space-y-0.5">
                      {d.findings.map((f, i) => (
                        <li
                          key={i}
                          className="text-[10px] text-[var(--foreground)] pl-2.5 relative leading-snug"
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
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle size={11} className="text-red-500" />
                <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Risks
                </div>
              </div>
              <ol className="space-y-1">
                {result.risks.map((r, i) => (
                  <li
                    key={i}
                    className="text-[10.5px] text-[var(--foreground)] pl-5 relative leading-snug"
                  >
                    <span className="absolute left-0 top-0 w-3.5 h-3.5 rounded bg-red-50 text-red-600 text-[8px] font-mono font-bold inline-flex items-center justify-center">
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
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb size={11} className="text-[var(--accent)]" />
                <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Recommendations
                </div>
              </div>
              <ol className="space-y-1">
                {result.recommendations.map((r, i) => (
                  <li
                    key={i}
                    className="text-[10.5px] text-[var(--foreground)] pl-5 relative leading-snug"
                  >
                    <span className="absolute left-0 top-0 w-3.5 h-3.5 rounded bg-[var(--accent-soft)] text-[var(--accent)] text-[8px] font-mono font-bold inline-flex items-center justify-center">
                      {i + 1}
                    </span>
                    {r}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {error && <div className="text-[10.5px] text-red-600">{error}</div>}

          <div className="space-y-1.5">
            <button
              disabled={improving || result.recommendations.length === 0}
              onClick={onApplyTopFixes}
              className="w-full h-8 inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--foreground)] text-[var(--background)] text-[11px] font-medium hover:opacity-90 disabled:opacity-40"
            >
              {improving ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
              {improving ? 'Applying…' : 'Apply top 3 fixes'}
            </button>
            <button
              onClick={onReset}
              className="w-full h-7 inline-flex items-center justify-center rounded-md border border-[var(--hairline)] bg-white text-[11px] hover:bg-neutral-50"
            >
              Re-evaluate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreChip({ score }: { score: number }) {
  const color =
    score >= 8
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : score >= 6
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-red-50 text-red-700 border-red-200';
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[9px] font-mono font-bold tabular-nums ${color}`}
    >
      {score.toFixed(1)} / 10
    </span>
  );
}
