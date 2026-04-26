'use client';
import { useState } from 'react';
import { Comment } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { CheckCircle2, Pin } from 'lucide-react';
import { clsx } from 'clsx';

interface CommentThreadProps {
  comments: Comment[];
  onReply?: (parentId: string, body: string) => void;
}

export function CommentThread({ comments, onReply }: CommentThreadProps) {
  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-xs text-neutral-400">
        No comments yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {comments.map((c) => (
        <CommentCard key={c.id} comment={c} onReply={onReply} />
      ))}
    </div>
  );
}

function CommentCard({
  comment,
  onReply,
}: {
  comment: Comment;
  onReply?: (parentId: string, body: string) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');

  return (
    <div
      className={clsx(
        'rounded-lg border border-neutral-200 bg-white p-3',
        comment.resolved && 'opacity-60'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-full bg-neutral-200 inline-flex items-center justify-center text-[10px] font-bold text-neutral-600">
          {comment.authorName?.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="text-xs font-semibold">{comment.authorName}</div>
        <div className="text-[10px] text-neutral-400 font-mono">
          {timeAgo(comment.createdAt)}
        </div>
        {comment.resolved && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-emerald-600 font-mono">
            <CheckCircle2 size={11} />
            Resolved
          </span>
        )}
      </div>
      {comment.nodeId && (
        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-100 text-[9px] font-mono text-neutral-600 mb-1.5">
          <Pin size={9} />
          Pinned to node
        </div>
      )}
      <div className="text-xs text-neutral-700 leading-relaxed">{comment.body}</div>

      {!comment.resolved && onReply && (
        <div className="mt-2">
          {!replying ? (
            <button
              onClick={() => setReplying(true)}
              className="text-[10px] text-neutral-500 hover:text-neutral-900 font-mono"
            >
              Reply
            </button>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Reply…"
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if (reply.trim()) onReply(comment.id, reply);
                    setReply('');
                    setReplying(false);
                  }}
                >
                  Post
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 pl-4 border-l-2 border-neutral-100 space-y-2">
          {comment.replies.map((r) => (
            <CommentCard key={r.id} comment={r} onReply={onReply} />
          ))}
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
