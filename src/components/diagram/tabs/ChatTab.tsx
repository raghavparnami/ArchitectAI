'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send,
  Loader2,
  Sparkles,
  ArrowRight,
  Hammer,
  ClipboardCheck,
  AlertTriangle,
  Info,
  AlertOctagon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { useCanvasStore } from '@/stores/canvas.store';
import { ChatMessage, DiagramConnection, DiagramNode } from '@/lib/types';
import { autoPorts, bezierPath, portPosition } from '@/lib/canvas-utils';
import { NODE_TYPE_COLORS } from '@/lib/tech-catalog';

type Mode = 'design' | 'review';

type CritiqueItem = {
  severity: 'info' | 'warn' | 'risk';
  area: string;
  finding: string;
  suggestion: string;
};

const STARTERS = [
  'A real-time collaborative whiteboard SaaS',
  'An e-commerce checkout with Stripe and inventory',
  'A multi-tenant API with rate limiting',
];

const REVIEW_STARTERS = [
  'Will this scale to 1M daily active users?',
  'What is the biggest reliability risk?',
  'Where could costs explode at 10x traffic?',
];

export function ChatTab({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('design');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<DiagramNode[]>([]);
  const [connections, setConnections] = useState<DiagramConnection[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [critique, setCritique] = useState<CritiqueItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const createDiagram = useDiagramsStore((s) => s.createDiagram);
  const loadVersion = useCanvasStore((s) => s.loadVersion);
  const setStoreSuggestions = useCanvasStore((s) => s.setSuggestions);
  const setDiagramTitle = useCanvasStore((s) => s.setDiagramTitle);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy, critique]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    if (mode === 'review' && !problemStatement.trim()) {
      setError('Add a problem statement first so the review has context.');
      return;
    }
    setError(null);

    const newUserMsg: ChatMessage = {
      role: 'user',
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...messages, newUserMsg];
    setMessages(nextMessages);
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
          mode,
          problemStatement: mode === 'review' ? problemStatement : undefined,
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
        critique?: CritiqueItem[];
      } = await res.json();

      setNodes(data.nodes);
      setConnections(data.connections);
      setSuggestions(data.suggestions || []);
      setCritique(data.critique || []);
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: data.reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const openInEditor = () => {
    if (nodes.length === 0) return;
    const title =
      messages.find((m) => m.role === 'user')?.content.slice(0, 40) ||
      'Untitled Diagram';

    const newDiagram = createDiagram({
      title,
      status: 'draft',
      nodes,
      connections,
      suggestions,
      messages,
      techIds: Array.from(
        new Set(
          nodes.map((n) => n.techId).filter((t): t is string => Boolean(t))
        )
      ),
    });

    loadVersion(nodes, connections, [], []);
    setStoreSuggestions(suggestions);
    setDiagramTitle(newDiagram.title);

    onClose();
    router.push(`/diagram/${newDiagram.id}`);
  };

  const starters = mode === 'review' ? REVIEW_STARTERS : STARTERS;
  const placeholder =
    mode === 'review'
      ? 'Ask a review question (e.g. "What scales worst here?")'
      : 'Describe what to build, or ask for changes…';

  return (
    // Claude-style: design canvas on LEFT, chat rail on RIGHT.
    <div className="grid grid-cols-[1fr_440px] h-[560px]">
      {/* Live preview (left) */}
      <div className="flex flex-col bg-[var(--background)]">
        <div className="px-4 py-2.5 border-b border-[var(--hairline)] flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Live preview
          </div>
          <span className="font-mono text-[10px] tnum text-[var(--muted)]">
            {nodes.length} nodes · {connections.length} edges
          </span>
        </div>
        <div
          className="flex-1 overflow-hidden relative"
          style={{
            backgroundColor: 'var(--paper, #FAF8F4)',
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(15,17,16,0.06) 1px, transparent 0)',
            backgroundSize: '18px 18px',
          }}
        >
          <PreviewCanvas nodes={nodes} connections={connections} />
        </div>
        <div className="p-3 border-t border-[var(--hairline)]">
          <Button
            onClick={openInEditor}
            disabled={nodes.length === 0 || busy}
            className="w-full"
          >
            Open in editor
            <ArrowRight size={13} />
          </Button>
        </div>
      </div>

      {/* Chat rail (right) */}
      <div className="flex flex-col border-l border-[var(--hairline)] bg-white">
        {/* Mode toggle */}
        <div className="px-3 pt-3 pb-2 border-b border-[var(--hairline)]">
          <div className="inline-flex p-0.5 rounded-lg bg-neutral-100 w-full">
            <ModePill
              icon={Hammer}
              label="Build"
              active={mode === 'design'}
              onClick={() => setMode('design')}
            />
            <ModePill
              icon={ClipboardCheck}
              label="Review"
              active={mode === 'review'}
              onClick={() => setMode('review')}
            />
          </div>
          {mode === 'review' && (
            <textarea
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              placeholder="Problem statement — what is this system supposed to solve? (e.g. 'serve 50k concurrent video viewers with sub-second latency')"
              rows={2}
              className="mt-2 w-full text-[11px] leading-relaxed px-2.5 py-2 rounded-md border border-[var(--hairline)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] resize-none"
            />
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 ? (
            <div className="text-center pt-6">
              <div className="w-11 h-11 rounded-2xl bg-[var(--accent-soft)] inline-flex items-center justify-center mb-3">
                {mode === 'review' ? (
                  <ClipboardCheck size={18} className="text-[var(--accent)]" />
                ) : (
                  <Sparkles size={18} className="text-[var(--accent)]" />
                )}
              </div>
              <h3 className="font-display text-xl mb-1">
                {mode === 'review' ? (
                  <>
                    Review with <span className="font-display-italic">AI</span>
                  </>
                ) : (
                  <>
                    Design with <span className="font-display-italic">AI</span>
                  </>
                )}
              </h3>
              <p className="text-xs text-[var(--muted)] mb-4 max-w-xs mx-auto">
                {mode === 'review'
                  ? 'Add a problem statement, then ask review questions about the current design.'
                  : 'Describe what you want to build. The diagram updates as you chat.'}
              </p>
              <div className="space-y-1.5 max-w-sm mx-auto">
                {starters.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full text-left px-3 py-2 rounded-md border border-[var(--hairline)] bg-white hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40 transition text-xs"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === 'user'
                      ? 'flex justify-end'
                      : 'flex justify-start'
                  }
                >
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--foreground)] text-[var(--background)] px-3.5 py-2 text-xs leading-relaxed'
                        : 'max-w-[85%] rounded-2xl rounded-tl-sm bg-[var(--accent-soft)] text-[var(--foreground)] px-3.5 py-2 text-xs leading-relaxed'
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[var(--accent-soft)] text-[var(--foreground)] px-3.5 py-2 text-xs flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" />
                    {mode === 'review' ? 'Reviewing…' : 'Thinking…'}
                  </div>
                </div>
              )}

              {/* Critique items — only shown in review mode */}
              {mode === 'review' && critique.length > 0 && !busy && (
                <div className="pt-2 space-y-1.5">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--muted)] mb-1">
                    Findings · {critique.length}
                  </div>
                  {critique.map((c, i) => (
                    <CritiqueCard key={i} item={c} />
                  ))}
                </div>
              )}

              {suggestions.length > 0 && !busy && (
                <div className="pt-2">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    Try
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => send(s)}
                        className="text-[10px] px-2 py-1 rounded-full bg-white border border-[var(--hairline)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40 text-left max-w-full"
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
          <div className="px-4 pb-2 text-[11px] text-red-600">{error}</div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-[var(--hairline)] p-3 flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            placeholder={placeholder}
            className="flex-1 h-9 bg-[var(--background)] border border-[var(--hairline)] rounded-md px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </form>
      </div>
    </div>
  );
}

function ModePill({
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

function CritiqueCard({ item }: { item: CritiqueItem }) {
  const sev = item.severity;
  const palette =
    sev === 'risk'
      ? {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          Icon: AlertOctagon,
        }
      : sev === 'warn'
      ? {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-700',
          Icon: AlertTriangle,
        }
      : {
          bg: 'bg-sky-50',
          border: 'border-sky-200',
          text: 'text-sky-700',
          Icon: Info,
        };
  const Icon = palette.Icon;
  return (
    <div className={clsx('rounded-md border p-2.5', palette.bg, palette.border)}>
      <div className={clsx('flex items-center gap-1.5 mb-1', palette.text)}>
        <Icon size={11} />
        <span className="font-mono text-[9px] uppercase tracking-wider">
          {sev} · {item.area}
        </span>
      </div>
      <div className="text-[11px] leading-snug text-[var(--foreground)] mb-1">
        {item.finding}
      </div>
      <div className="text-[10.5px] leading-snug text-[var(--muted)]">
        → {item.suggestion}
      </div>
    </div>
  );
}

function PreviewCanvas({
  nodes,
  connections,
}: {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
}) {
  if (nodes.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-[10px] text-[var(--muted)]">
        Empty — start chatting to populate
      </div>
    );
  }

  // Compute bbox with generous padding so labels and shadows don't clip.
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs) - 30;
  const minY = Math.min(...ys) - 30;
  const maxX = Math.max(...nodes.map((n) => n.x + (n.width ?? 180))) + 30;
  const maxY = Math.max(...nodes.map((n) => n.y + (n.height ?? 92))) + 40;
  const w = maxX - minX;
  const h = maxY - minY;

  return (
    <svg
      viewBox={`${minX} ${minY} ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
    >
      <defs>
        <marker
          id="preview-arrow"
          viewBox="0 0 12 12"
          refX="10"
          refY="6"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 12 6 L 0 12 L 3 6 Z" fill="#8B7E6A" />
        </marker>
        <filter id="preview-card-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0E0F10" floodOpacity="0.10" />
        </filter>
      </defs>

      {/* Connections — drawn first so they appear under the cards. */}
      {connections.map((c) => {
        const from = nodes.find((n) => n.id === c.fromNodeId);
        const to = nodes.find((n) => n.id === c.toNodeId);
        if (!from || !to) return null;
        const ports = autoPorts(from, to);
        const a = portPosition(from, ports.fromPort);
        const b = portPosition(to, ports.toPort);
        const d = bezierPath(a, b, ports.fromPort, ports.toPort);
        // Midpoint for the optional label pill.
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const label = c.label?.trim();
        return (
          <g key={c.id}>
            <path
              d={d}
              stroke="#A6957A"
              strokeWidth={1.4}
              fill="none"
              strokeLinecap="round"
              markerEnd="url(#preview-arrow)"
              opacity={0.9}
            />
            {label && label.length > 0 && (
              <g>
                <rect
                  x={mx - label.length * 3 - 6}
                  y={my - 8}
                  width={label.length * 6 + 12}
                  height={14}
                  rx={7}
                  fill="#FFFFFF"
                  stroke="#E8E0D0"
                  strokeWidth={1}
                />
                <text
                  x={mx}
                  y={my + 2}
                  textAnchor="middle"
                  fontSize={9}
                  fontFamily="ui-monospace, 'SF Mono', monospace"
                  fontWeight={500}
                  fill="#6F6A60"
                  letterSpacing="0.04em"
                >
                  {label.length > 14 ? label.slice(0, 13) + '…' : label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Nodes — soft-tinted cards with a colored accent stripe + type badge. */}
      {nodes.map((n) => {
        const color = NODE_TYPE_COLORS[n.type] ?? '#6F6A60';
        const nw = n.width ?? 180;
        const nh = n.height ?? 92;
        const label = n.label;
        const labelLine =
          label.length > 22 ? label.slice(0, 21) + '…' : label;
        return (
          <g key={n.id} filter="url(#preview-card-shadow)">
            {/* Card body */}
            <rect
              x={n.x}
              y={n.y}
              width={nw}
              height={nh}
              rx={10}
              ry={10}
              fill="#FFFFFF"
              stroke={`${color}55`}
              strokeWidth={1.25}
            />
            {/* Top accent stripe — colored by node type */}
            <rect
              x={n.x}
              y={n.y}
              width={nw}
              height={4}
              rx={10}
              ry={10}
              fill={color}
              opacity={0.85}
            />
            {/* Type badge (pill) in the top-right corner */}
            <g>
              <rect
                x={n.x + nw - 56}
                y={n.y + 11}
                width={48}
                height={14}
                rx={7}
                fill={`${color}1A`}
                stroke={`${color}55`}
                strokeWidth={0.75}
              />
              <text
                x={n.x + nw - 32}
                y={n.y + 21}
                textAnchor="middle"
                fontSize={8}
                fontFamily="ui-monospace, 'SF Mono', monospace"
                fontWeight={700}
                fill={color}
                letterSpacing="0.08em"
              >
                {n.type.toUpperCase().slice(0, 7)}
              </text>
            </g>
            {/* Label — placed below the accent stripe */}
            <text
              x={n.x + 12}
              y={n.y + nh / 2 + 8}
              fontSize={13}
              fontFamily="ui-sans-serif, system-ui, -apple-system"
              fontWeight={600}
              fill="#0E0F10"
            >
              {labelLine}
            </text>
            {/* Optional description in muted text */}
            {n.desc && (
              <text
                x={n.x + 12}
                y={n.y + nh - 10}
                fontSize={9.5}
                fontFamily="ui-sans-serif, system-ui"
                fontWeight={400}
                fill="#8B8378"
              >
                {n.desc.length > 28 ? n.desc.slice(0, 27) + '…' : n.desc}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
