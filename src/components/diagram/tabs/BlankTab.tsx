'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { useCanvasStore } from '@/stores/canvas.store';
import { FilePlus2 } from 'lucide-react';

export function BlankTab({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState('Untitled Diagram');
  const createDiagram = useDiagramsStore((s) => s.createDiagram);
  const reset = useCanvasStore((s) => s.reset);
  const setDiagramTitle = useCanvasStore((s) => s.setDiagramTitle);

  const submit = () => {
    const d = createDiagram({ title: title.trim() || 'Untitled Diagram', status: 'draft' });
    reset();
    setDiagramTitle(d.title);
    onClose();
    router.push(`/diagram/${d.id}`);
  };

  return (
    <div className="px-8 py-10">
      <div className="flex flex-col items-center text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] inline-flex items-center justify-center mb-4">
          <FilePlus2 size={24} className="text-[var(--accent)]" />
        </div>
        <h3 className="font-display text-3xl mb-2">
          Start from <span className="font-display-italic">scratch</span>
        </h3>
        <p className="text-sm text-[var(--muted)] mb-6 leading-relaxed">
          Open an empty canvas and build the diagram manually. Drag shapes from the
          palette, connect with handles, and use the AI assistant if you get stuck.
        </p>
        <div className="w-full mb-4 text-left">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
            Diagram name
          </div>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled Diagram"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoFocus
          />
        </div>
        <Button onClick={submit} className="w-full">
          Create blank diagram
        </Button>
      </div>
    </div>
  );
}
