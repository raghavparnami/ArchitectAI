'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Canvas } from '@/components/canvas/Canvas';
import { ComponentPalette } from '@/components/canvas/ComponentPalette';
import { PropertiesPopup } from '@/components/canvas/PropertiesPopup';
import { EvaluationPanel } from '@/components/canvas/EvaluationPanel';
import { EditorChatPanel } from '@/components/canvas/EditorChatPanel';
import { ShareModal } from '@/components/diagram/ShareModal';
import { TopNav } from '@/components/layout/TopNav';
import { Button } from '@/components/ui/Button';
import { useCanvasStore } from '@/stores/canvas.store';
import { useDiagramsStore } from '@/stores/diagrams.store';
import {
  CheckCircle2,
  ChevronLeft,
  AlertTriangle,
  Wand2,
  Shapes as ShapesIcon,
  Sparkles,
  Share2,
} from 'lucide-react';
import { StatusBadge } from '@/components/diagram/StatusBadge';
import { clsx } from 'clsx';

type LeftMode = 'palette' | 'chat' | null;

export default function DiagramEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const hasHydrated = useDiagramsStore((s) => s.hasHydrated);
  const diagram = useDiagramsStore((s) => s.diagrams.find((d) => d.id === id));
  const updateSnapshot = useDiagramsStore((s) => s.updateSnapshot);
  const updateDiagram = useDiagramsStore((s) => s.updateDiagram);

  const loadVersion = useCanvasStore((s) => s.loadVersion);
  const setSuggestions = useCanvasStore((s) => s.setSuggestions);
  const setDiagramTitle = useCanvasStore((s) => s.setDiagramTitle);
  const title = useCanvasStore((s) => s.diagramTitle);

  const [loaded, setLoaded] = useState(false);
  const [leftMode, setLeftMode] = useState<LeftMode>('palette');
  const [evalOpen, setEvalOpen] = useState(false);

  // Load diagram into canvas store
  useEffect(() => {
    if (!hasHydrated) return;
    if (!diagram) {
      setLoaded(true);
      return;
    }
    loadVersion(diagram.nodes, diagram.connections, diagram.groups, diagram.strokes);
    setSuggestions(diagram.suggestions || []);
    setDiagramTitle(diagram.title);
    // If the diagram has chat history, default to chat panel
    if (diagram.messages && diagram.messages.length > 0) {
      setLeftMode('chat');
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, id]);

  // Persist title edits
  useEffect(() => {
    if (!loaded || !diagram) return;
    if (title === diagram.title) return;
    const t = setTimeout(() => updateDiagram(id, { title }), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  if (!hasHydrated) {
    return <FullScreenMessage>Loading…</FullScreenMessage>;
  }

  if (!diagram) {
    return (
      <>
        <TopNav />
        <div className="flex-1 flex items-center justify-center bg-paper">
          <div className="text-center">
            <AlertTriangle size={32} className="text-[var(--accent)] mx-auto mb-3" />
            <h2 className="text-base font-semibold mb-1">Diagram not found</h2>
            <p className="text-xs text-[var(--muted)] mb-5">
              This diagram doesn&apos;t exist or has been deleted.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--foreground)] hover:opacity-70"
            >
              <ChevronLeft size={13} />
              Back to dashboard
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopNav
        centerSlot={
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/dashboard"
              className="p-1.5 rounded hover:bg-neutral-100 text-[var(--muted)] shrink-0"
            >
              <ChevronLeft size={16} />
            </Link>
            <button
              onClick={() => setLeftMode((m) => (m === 'palette' ? null : 'palette'))}
              className={clsx(
                'p-1.5 rounded hover:bg-neutral-100',
                leftMode === 'palette' ? 'text-[var(--foreground)] bg-neutral-100' : 'text-[var(--muted)]'
              )}
              title="Components palette"
            >
              <ShapesIcon size={14} />
            </button>
            <button
              onClick={() => setLeftMode((m) => (m === 'chat' ? null : 'chat'))}
              className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md border text-[11px] font-mono font-semibold uppercase tracking-wider transition',
                leftMode === 'chat'
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-sm'
                  : 'bg-[var(--accent-soft)] border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white'
              )}
              title="AI design chat — modify the architecture conversationally"
            >
              <Sparkles size={12} />
              AI Chat
            </button>
            <input
              value={title}
              onChange={(e) => setDiagramTitle(e.target.value)}
              className="font-display text-xl bg-transparent outline-none focus:bg-neutral-50 px-2 py-0.5 rounded min-w-0 flex-1 max-w-md"
            />
            <StatusBadge status={diagram.status} />
          </div>
        }
        rightSlot={
          <>
            <Button size="sm" variant="secondary" onClick={() => setEvalOpen(true)}>
              <Wand2 size={14} />
              Improve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => router.push(`/diagram/${id}/approval`)}
            >
              <CheckCircle2 size={14} />
              Approval
            </Button>
          </>
        }
      />

      <div className="flex-1 flex min-h-0">
        {leftMode === 'palette' && (
          <ComponentPalette open={true} onToggle={() => setLeftMode(null)} />
        )}
        {leftMode === 'chat' && (
          <EditorChatPanel diagramId={id} onClose={() => setLeftMode(null)} />
        )}
        <div className="flex-1 relative min-w-0">
          <Canvas
            diagramId={id}
            onSave={(snapshot) =>
              updateSnapshot(id, {
                nodes: snapshot.nodes,
                connections: snapshot.connections,
                groups: snapshot.groups,
                strokes: snapshot.strokes,
              })
            }
          />
          <PropertiesPopup />
          <EvaluationPanel open={evalOpen} onClose={() => setEvalOpen(false)} />
        </div>
      </div>
    </>
  );
}

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-paper">
      <div className="text-sm text-[var(--muted)]">{children}</div>
    </div>
  );
}
