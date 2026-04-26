'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, RotateCcw, ChevronLeft, X } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas.store';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { ChatMessage, DiagramConnection, DiagramNode } from '@/lib/types';

interface Props {
  diagramId: string;
  onClose: () => void;
}

export function EditorChatPanel({ diagramId, onClose }: Props) {
  const diagram = useDiagramsStore((s) => s.diagrams.find((d) => d.id === diagramId));
  const updateDiagram = useDiagramsStore((s) => s.updateDiagram);

  const nodes = useCanvasStore((s) => s.nodes);
  const connections = useCanvasStore((s) => s.connections);
  const groups = useCanvasStore((s) => s.groups);
  const strokes = useCanvasStore((s) => s.strokes);
  const loadVersion = useCanvasStore((s) => s.loadVersion);

  const messages: ChatMessage[] = diagram?.messages ?? [];

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

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

      // Update both canvas store (live view) and diagrams store (persistence)
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

  const restartChat = () => {
    if (!confirm('Clear the conversation? The diagram itself will not change.')) return;
    updateDiagram(diagramId, { messages: [] });
    setSuggestions([]);
    setError(null);
  };

  return (
    <aside className="w-80 border-r border-[var(--hairline)] bg-white flex flex-col shrink-0">
      <div className="px-3 h-10 border-b border-[var(--hairline)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-[var(--accent)]" />
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">
            Design Chat
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={restartChat}
            disabled={messages.length === 0}
            title="Clear conversation"
            className="p-1 rounded text-[var(--muted)] hover:bg-neutral-100 hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RotateCcw size={11} />
          </button>
          <button
            onClick={onClose}
            title="Close chat"
            className="p-1 rounded text-[var(--muted)] hover:bg-neutral-100 hover:text-[var(--foreground)]"
          >
            <ChevronLeft size={12} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="text-center pt-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] inline-flex items-center justify-center mb-2">
              <Sparkles size={16} className="text-[var(--accent)]" />
            </div>
            <h3 className="font-display text-lg mb-1">
              Refine with <span className="font-display-italic">AI</span>
            </h3>
            <p className="text-[10px] text-[var(--muted)] leading-relaxed mb-4 max-w-[200px] mx-auto">
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
    </aside>
  );
}
