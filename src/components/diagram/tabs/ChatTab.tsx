'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { useCanvasStore } from '@/stores/canvas.store';
import { ChatMessage, DiagramConnection, DiagramNode } from '@/lib/types';
import { autoPorts, bezierPath, portPosition } from '@/lib/canvas-utils';
import { NODE_TYPE_COLORS } from '@/lib/tech-catalog';

const STARTERS = [
  'A real-time collaborative whiteboard SaaS',
  'An e-commerce checkout with Stripe and inventory',
  'A multi-tenant API with rate limiting',
];

export function ChatTab({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<DiagramNode[]>([]);
  const [connections, setConnections] = useState<DiagramConnection[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const createDiagram = useDiagramsStore((s) => s.createDiagram);
  const loadVersion = useCanvasStore((s) => s.loadVersion);
  const setStoreSuggestions = useCanvasStore((s) => s.setSuggestions);
  const setDiagramTitle = useCanvasStore((s) => s.setDiagramTitle);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
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

      setNodes(data.nodes);
      setConnections(data.connections);
      setSuggestions(data.suggestions || []);
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

  return (
    <div className="grid grid-cols-[1fr_360px] h-[480px]">
      {/* Chat panel */}
      <div className="flex flex-col border-r border-[var(--hairline)]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <div className="text-center pt-8">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent-soft)] inline-flex items-center justify-center mb-3">
                <Sparkles size={20} className="text-[var(--accent)]" />
              </div>
              <h3 className="font-display text-2xl mb-1">
                Design with <span className="font-display-italic">AI</span>
              </h3>
              <p className="text-xs text-[var(--muted)] mb-5 max-w-xs mx-auto">
                Describe what you want to build. The diagram updates as you chat.
              </p>
              <div className="space-y-1.5 max-w-sm mx-auto">
                {STARTERS.map((s) => (
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
                        ? 'max-w-[80%] rounded-2xl rounded-tr-sm bg-[var(--foreground)] text-[var(--background)] px-3.5 py-2 text-xs leading-relaxed'
                        : 'max-w-[80%] rounded-2xl rounded-tl-sm bg-[var(--accent-soft)] text-[var(--foreground)] px-3.5 py-2 text-xs leading-relaxed'
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-[var(--accent-soft)] text-[var(--foreground)] px-3.5 py-2 text-xs flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" />
                    Thinking…
                  </div>
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
          <div className="px-5 pb-2 text-[11px] text-red-600">{error}</div>
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
            placeholder="Describe what to build, or ask for changes…"
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

      {/* Live preview */}
      <div className="flex flex-col bg-[var(--background)]">
        <div className="px-4 py-2 border-b border-[var(--hairline)] flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Live preview
          </div>
          <span className="font-mono text-[10px] tnum text-[var(--muted)]">
            {nodes.length} nodes · {connections.length} edges
          </span>
        </div>
        <div className="flex-1 overflow-hidden relative">
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

  // Compute bbox
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs) - 20;
  const minY = Math.min(...ys) - 20;
  const maxX = Math.max(...nodes.map((n) => n.x + (n.width ?? 140))) + 20;
  const maxY = Math.max(...nodes.map((n) => n.y + (n.height ?? 80))) + 20;
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
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#3F3A33" />
        </marker>
      </defs>
      {connections.map((c) => {
        const from = nodes.find((n) => n.id === c.fromNodeId);
        const to = nodes.find((n) => n.id === c.toNodeId);
        if (!from || !to) return null;
        const ports = autoPorts(from, to);
        const a = portPosition(from, ports.fromPort);
        const b = portPosition(to, ports.toPort);
        const d = bezierPath(a, b, ports.fromPort, ports.toPort);
        return (
          <path
            key={c.id}
            d={d}
            stroke="#3F3A33"
            strokeWidth={1.5}
            fill="none"
            markerEnd="url(#preview-arrow)"
          />
        );
      })}
      {nodes.map((n) => {
        const color = NODE_TYPE_COLORS[n.type] ?? '#6F6A60';
        return (
          <g key={n.id}>
            <rect
              x={n.x}
              y={n.y}
              width={n.width ?? 140}
              height={n.height ?? 80}
              rx={6}
              fill="#FFFFFF"
              stroke={color}
              strokeWidth={1.5}
            />
            <text
              x={n.x + (n.width ?? 140) / 2}
              y={n.y + (n.height ?? 80) / 2 + 4}
              textAnchor="middle"
              fontSize={11}
              fontFamily="ui-sans-serif, system-ui"
              fontWeight={600}
              fill="#0E0F10"
            >
              {n.label.length > 16 ? n.label.slice(0, 15) + '…' : n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
