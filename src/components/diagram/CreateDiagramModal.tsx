'use client';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Image as ImageIcon, MessageSquare, FilePlus2 } from 'lucide-react';
import { clsx } from 'clsx';
import { ImportTab } from './tabs/ImportTab';
import { ChatTab } from './tabs/ChatTab';
import { BlankTab } from './tabs/BlankTab';

type Tab = 'chat' | 'import' | 'blank';

interface Props {
  open: boolean;
  onClose: () => void;
}

const TABS: { id: Tab; label: string; icon: typeof ImageIcon }[] = [
  { id: 'chat',   label: 'Design Chat', icon: MessageSquare },
  { id: 'import', label: 'Import',      icon: ImageIcon },
  { id: 'blank',  label: 'Blank',       icon: FilePlus2 },
];

export function CreateDiagramModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('chat');

  return (
    <Modal open={open} onClose={onClose} size="xl" title="Create new diagram">
      <div className="border-b border-[var(--hairline)] bg-neutral-50">
        <div className="px-6 flex items-center gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'inline-flex items-center gap-2 px-4 h-11 text-xs font-mono font-semibold uppercase tracking-wider border-b-2 -mb-px transition',
                  active
                    ? 'border-[var(--accent)] text-[var(--foreground)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
                )}
              >
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-[420px]">
        {tab === 'chat'   && <ChatTab onClose={onClose} />}
        {tab === 'import' && <ImportTab onClose={onClose} />}
        {tab === 'blank'  && <BlankTab onClose={onClose} />}
      </div>
    </Modal>
  );
}
