'use client';
import { UserButton } from '@clerk/nextjs';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface HeaderProps {
  title?: string;
  onNewDiagram?: () => void;
}

export function Header({ title, onNewDiagram }: HeaderProps) {
  return (
    <header className="h-14 border-b border-neutral-200 bg-white px-6 flex items-center justify-between">
      <h1 className="text-base font-semibold">{title}</h1>
      <div className="flex items-center gap-3">
        {onNewDiagram && (
          <Button size="sm" onClick={onNewDiagram}>
            <Plus size={14} />
            New diagram
          </Button>
        )}
        <UserButton />
      </div>
    </header>
  );
}
