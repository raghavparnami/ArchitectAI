'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Canvas } from '@/components/canvas/Canvas';
import { ApprovalPanel } from '@/components/approval/ApprovalPanel';
import { TopNav } from '@/components/layout/TopNav';
import { useCanvasStore } from '@/stores/canvas.store';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { Comment } from '@/lib/types';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '@/components/diagram/StatusBadge';

const CURRENT_USER_ID = 'current_user';

export default function ApprovalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const hasHydrated = useDiagramsStore((s) => s.hasHydrated);
  const diagram = useDiagramsStore((s) => s.diagrams.find((d) => d.id === id));
  const setStatus = useDiagramsStore((s) => s.setStatus);

  const loadVersion = useCanvasStore((s) => s.loadVersion);
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    if (!hasHydrated || !diagram) return;
    loadVersion(diagram.nodes, diagram.connections, diagram.groups, diagram.strokes);
  }, [hasHydrated, diagram, loadVersion]);

  if (!hasHydrated) {
    return (
      <>
        <TopNav />
        <div className="flex-1 flex items-center justify-center bg-paper text-sm text-[var(--muted)]">
          Loading…
        </div>
      </>
    );
  }

  if (!diagram) {
    return (
      <>
        <TopNav />
        <div className="flex-1 flex items-center justify-center bg-paper">
          <div className="text-center">
            <AlertTriangle size={32} className="text-[var(--accent)] mx-auto mb-3" />
            <h2 className="text-base font-semibold mb-1">Diagram not found</h2>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--foreground)] hover:opacity-70 mt-3"
            >
              <ChevronLeft size={13} />
              Back to dashboard
            </Link>
          </div>
        </div>
      </>
    );
  }

  const handleSubmitForReview = () => setStatus(id, 'review');
  const handleApprove = (note: string) => {
    setStatus(id, 'approved');
    if (note) addComment(`Approved: ${note}`);
  };
  const handleReject = (note: string) => {
    setStatus(id, 'rejected');
    if (note) addComment(`Rejected: ${note}`);
  };
  const addComment = (body: string) => {
    setComments((prev) => [
      ...prev,
      {
        id: `c_${Date.now()}`,
        diagramId: id,
        authorId: CURRENT_USER_ID,
        authorName: 'You',
        body,
        resolved: false,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  return (
    <>
      <TopNav
        centerSlot={
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => router.push(`/diagram/${id}`)}
              className="p-1.5 rounded hover:bg-neutral-100 text-[var(--muted)] shrink-0"
              title="Back to editor"
            >
              <ChevronLeft size={16} />
            </button>
            <h1 className="font-display text-xl truncate">{diagram.title}</h1>
            <StatusBadge status={diagram.status} />
          </div>
        }
      />
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 relative min-w-0">
          <Canvas diagramId={id} readOnly />
        </div>
        <ApprovalPanel
          diagram={diagram}
          comments={comments}
          currentUserId={CURRENT_USER_ID}
          onSubmitForReview={handleSubmitForReview}
          onApprove={handleApprove}
          onReject={handleReject}
          onAddComment={addComment}
        />
      </div>
    </>
  );
}
