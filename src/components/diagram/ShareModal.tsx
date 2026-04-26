'use client';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useDiagramsStore } from '@/stores/diagrams.store';
import {
  Mail,
  Eye,
  CheckCircle2,
  X,
  Link as LinkIcon,
  Copy,
  Check,
} from 'lucide-react';
import { AssigneeRole } from '@/lib/types';
import { clsx } from 'clsx';

interface Props {
  open: boolean;
  onClose: () => void;
  diagramId: string;
}

export function ShareModal({ open, onClose, diagramId }: Props) {
  const diagram = useDiagramsStore((s) => s.diagrams.find((d) => d.id === diagramId));
  const addAssignee = useDiagramsStore((s) => s.addAssignee);
  const removeAssignee = useDiagramsStore((s) => s.removeAssignee);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<AssigneeRole>('reviewer');
  const [copied, setCopied] = useState(false);

  const submit = () => {
    if (!email.trim() || !email.includes('@')) return;
    addAssignee(diagramId, {
      email: email.trim(),
      name: name.trim() || undefined,
      role,
    });
    setEmail('');
    setName('');
  };

  const copyLink = () => {
    const url = `${window.location.origin}/diagram/${diagramId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const assignees = diagram?.assignees ?? [];
  const reviewers = assignees.filter((a) => a.role === 'reviewer');
  const approvers = assignees.filter((a) => a.role === 'approver');

  return (
    <Modal open={open} onClose={onClose} size="md" title="Share architecture">
      <div className="px-6 py-5 space-y-5">
        {/* Share link */}
        <div>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
            Share link
          </div>
          <div className="flex items-center gap-2 rounded-md border border-[var(--hairline)] bg-neutral-50 px-3 py-2">
            <LinkIcon size={13} className="text-[var(--muted)] shrink-0" />
            <span className="flex-1 font-mono text-[11px] text-[var(--muted)] truncate">
              /diagram/{diagramId}
            </span>
            <button
              onClick={copyLink}
              className="text-[10px] font-mono uppercase font-semibold text-[var(--accent)] hover:opacity-80 inline-flex items-center gap-1"
            >
              {copied ? (
                <>
                  <Check size={11} /> Copied
                </>
              ) : (
                <>
                  <Copy size={11} /> Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Add assignee form */}
        <div>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
            Invite a reviewer or approver
          </div>
          <div className="space-y-2">
            <div className="relative">
              <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@company.com"
                className="pl-9"
                autoFocus
              />
            </div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('reviewer')}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-md border-2 text-left transition',
                  role === 'reviewer'
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--hairline)] hover:border-[var(--foreground)]'
                )}
              >
                <Eye size={14} className="text-[var(--accent)]" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold">Reviewer</div>
                  <div className="text-[10px] text-[var(--muted)]">Comment & suggest</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setRole('approver')}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-md border-2 text-left transition',
                  role === 'approver'
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--hairline)] hover:border-[var(--foreground)]'
                )}
              >
                <CheckCircle2 size={14} className="text-[var(--accent)]" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold">Approver</div>
                  <div className="text-[10px] text-[var(--muted)]">Approve or reject</div>
                </div>
              </button>
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={submit}
              disabled={!email.includes('@')}
            >
              Add as {role}
            </Button>
          </div>
        </div>

        {/* Assignee lists */}
        {(reviewers.length > 0 || approvers.length > 0) && (
          <div className="space-y-3 pt-2 border-t border-[var(--hairline)]">
            {approvers.length > 0 && (
              <AssigneeList
                title="Approvers"
                icon={<CheckCircle2 size={11} className="text-[var(--accent)]" />}
                people={approvers}
                onRemove={(id) => removeAssignee(diagramId, id)}
              />
            )}
            {reviewers.length > 0 && (
              <AssigneeList
                title="Reviewers"
                icon={<Eye size={11} className="text-[var(--accent)]" />}
                people={reviewers}
                onRemove={(id) => removeAssignee(diagramId, id)}
              />
            )}
          </div>
        )}
      </div>
      <div className="px-6 py-3 border-t border-[var(--hairline)] bg-neutral-50 flex justify-end">
        <Button size="sm" variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

function AssigneeList({
  title,
  icon,
  people,
  onRemove,
}: {
  title: string;
  icon: React.ReactNode;
  people: { id: string; email: string; name?: string }[];
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
        {icon}
        {title} ({people.length})
      </div>
      <div className="space-y-1">
        {people.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-neutral-50 border border-[var(--hairline)]"
          >
            <div className="w-6 h-6 rounded-full bg-[var(--accent-soft)] inline-flex items-center justify-center text-[10px] font-bold text-[var(--accent)]">
              {(p.name || p.email).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{p.name || p.email}</div>
              {p.name && (
                <div className="text-[10px] text-[var(--muted)] truncate">{p.email}</div>
              )}
            </div>
            <button
              onClick={() => onRemove(p.id)}
              className="p-1 rounded hover:bg-red-50 text-[var(--muted)] hover:text-red-600"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
