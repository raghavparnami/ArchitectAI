'use client';
import { useState } from 'react';
import { Sparkles, Send, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useCanvasStore } from '@/stores/canvas.store';

export function AIAssistantBar() {
  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = useCanvasStore((s) => s.suggestions);
  const nodes = useCanvasStore((s) => s.nodes);
  const connections = useCanvasStore((s) => s.connections);
  const loadVersion = useCanvasStore((s) => s.loadVersion);
  const setSuggestions = useCanvasStore((s) => s.setSuggestions);
  const groups = useCanvasStore((s) => s.groups);
  const strokes = useCanvasStore((s) => s.strokes);

  const sendInstruction = async (instruction: string) => {
    if (!instruction.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, nodes, connections }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Refinement failed');
      }
      const data = await res.json();
      loadVersion(data.nodes, data.connections, groups, strokes);
      setSuggestions(data.suggestions || []);
      setInput('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(720px,calc(100%-32px))]">
      <div className="bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 bg-neutral-50">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-wide text-neutral-600">
            <Sparkles size={12} className="text-amber-500" />
            AI Assistant
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1 rounded hover:bg-neutral-100 text-neutral-500"
          >
            {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {!collapsed && (
          <>
            {suggestions.length > 0 && (
              <div className="px-3 py-2 border-b border-neutral-100">
                <div className="text-[9px] font-mono font-semibold uppercase text-neutral-400 mb-1.5">
                  Suggestions
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      disabled={busy}
                      onClick={() => sendInstruction(s)}
                      className={clsx(
                        'px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] text-amber-900 hover:bg-amber-100 transition text-left max-w-full',
                        busy && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendInstruction(input);
              }}
              className="flex items-center gap-2 px-3 py-2.5"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
                placeholder="Ask the AI to refine the diagram… (e.g. 'add a Redis cache between API and DB')"
                className="flex-1 h-9 bg-neutral-50 border border-neutral-200 rounded-md px-3 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </form>

            {error && (
              <div className="px-3 pb-2 text-[11px] text-red-600">{error}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
