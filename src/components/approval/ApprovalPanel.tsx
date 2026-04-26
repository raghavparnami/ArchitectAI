'use client';
import { useState } from 'react';
import { Comment, Diagram, DiagramStatus } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { WorkflowBar } from './WorkflowBar';
import { CommentThread } from './CommentThread';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ApprovalPanelProps {
  diagram: Diagram;
  comments: Comment[];
  currentUserId: string;
  onSubmitForReview?: () => void;
  onApprove?: (note: string) => void;
  onReject?: (note: string) => void;
  onAddComment?: (body: string) => void;
}

export function ApprovalPanel({
  diagram,
  comments,
  currentUserId,
  onSubmitForReview,
  onApprove,
  onReject,
  onAddComment,
}: ApprovalPanelProps) {
  const [actionNote, setActionNote] = useState('');
  const [newComment, setNewComment] = useState('');
  const isAuthor = diagram.authorId === currentUserId;

  return (
    <aside className="w-[360px] border-l border-neutral-200 bg-white flex flex-col h-full">
      <div className="px-5 py-4 border-b border-neutral-200">
        <div className="text-[10px] font-mono font-semibold uppercase tracking-wide text-neutral-500 mb-3">
          Workflow
        </div>
        <WorkflowBar status={diagram.status} />
      </div>

      <div className="px-5 py-4 border-b border-neutral-200">
        <ActionArea
          status={diagram.status}
          isAuthor={isAuthor}
          actionNote={actionNote}
          setActionNote={setActionNote}
          onSubmitForReview={onSubmitForReview}
          onApprove={onApprove}
          onReject={onReject}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="text-[10px] font-mono font-semibold uppercase tracking-wide text-neutral-500 mb-3">
          Comments ({comments.length})
        </div>
        <CommentThread comments={comments} />
      </div>

      <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={!newComment.trim()}
            onClick={() => {
              if (newComment.trim()) {
                onAddComment?.(newComment);
                setNewComment('');
              }
            }}
          >
            Add comment
          </Button>
        </div>
      </div>
    </aside>
  );
}

function ActionArea({
  status,
  isAuthor,
  actionNote,
  setActionNote,
  onSubmitForReview,
  onApprove,
  onReject,
}: {
  status: DiagramStatus;
  isAuthor: boolean;
  actionNote: string;
  setActionNote: (v: string) => void;
  onSubmitForReview?: () => void;
  onApprove?: (note: string) => void;
  onReject?: (note: string) => void;
}) {
  if (status === 'draft') {
    return (
      <div>
        <p className="text-xs text-neutral-600 mb-3">
          Ready to share this with reviewers?
        </p>
        <Button
          size="sm"
          onClick={onSubmitForReview}
          className="w-full bg-amber-500 hover:bg-amber-600"
        >
          Submit for Review
        </Button>
      </div>
    );
  }

  if (status === 'review') {
    if (isAuthor) {
      return (
        <p className="text-xs text-neutral-500">
          Awaiting reviewer action. You cannot approve your own diagram.
        </p>
      );
    }
    return (
      <div className="space-y-3">
        <Textarea
          rows={2}
          value={actionNote}
          onChange={(e) => setActionNote(e.target.value)}
          placeholder="Optional note…"
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="success"
            onClick={() => onApprove?.(actionNote)}
          >
            <CheckCircle2 size={14} />
            Approve
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => onReject?.(actionNote)}
          >
            <XCircle size={14} />
            Reject
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'approved') {
    return (
      <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3">
        <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 size={14} />
          Approved
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-red-50 border border-red-200 p-3">
      <div className="flex items-center gap-2 text-red-700 text-xs font-semibold">
        <XCircle size={14} />
        Changes requested
      </div>
    </div>
  );
}
