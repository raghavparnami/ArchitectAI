'use client';
import { useState, useRef, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileCode, Loader2, FileJson, Hexagon, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { useCanvasStore } from '@/stores/canvas.store';
import { ImportSource, DiagramConnection, DiagramNode } from '@/lib/types';
import { clsx } from 'clsx';

type Format = 'auto' | 'xml' | 'mermaid' | 'json';

const FORMAT_TABS: { id: Format; label: string; icon: typeof FileCode }[] = [
  { id: 'auto',    label: 'Auto-detect', icon: Hexagon },
  { id: 'xml',     label: 'draw.io XML', icon: FileCode },
  { id: 'mermaid', label: 'Mermaid',     icon: FileCode },
  { id: 'json',    label: 'JSON',        icon: FileJson },
];

export function ImportTab({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [format, setFormat] = useState<Format>('auto');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<{ b64: string; mime: string } | null>(null);

  const createDiagram = useDiagramsStore((s) => s.createDiagram);
  const loadVersion = useCanvasStore((s) => s.loadVersion);
  const setSuggestions = useCanvasStore((s) => s.setSuggestions);
  const setDiagramTitle = useCanvasStore((s) => s.setDiagramTitle);

  const handleFile = (file: File) => {
    setError(null);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setImageDataUrl(dataUrl);
        const b64 = dataUrl.split(',')[1] ?? '';
        setImageBase64({ b64, mime: file.type });
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => setText(String(reader.result ?? ''));
      reader.readAsText(file);
    }
  };

  const onDropZone = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const detectSource = (raw: string): ImportSource => {
    if (format === 'xml') return 'xml';
    if (format === 'mermaid') return 'mermaid';
    if (format === 'json') return 'json';
    const t = raw.trim();
    if (t.startsWith('<')) return 'xml';
    if (t.startsWith('{') || t.startsWith('[')) return 'json';
    if (/^(flowchart|graph|erDiagram)/i.test(t)) return 'mermaid';
    return 'mermaid'; // safe default for plain text
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let body: { source: ImportSource; payload: string; mimeType?: string };
      if (imageBase64) {
        body = { source: 'image', payload: imageBase64.b64, mimeType: imageBase64.mime };
      } else if (text.trim()) {
        body = { source: detectSource(text), payload: text };
      } else {
        throw new Error('Drop a file or paste some content');
      }

      const res = await fetch('/api/ai/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Import failed');
      }
      const result: {
        title: string;
        nodes: DiagramNode[];
        connections: DiagramConnection[];
        suggestions: string[];
        sourceDetected: ImportSource;
      } = await res.json();

      if (!result.nodes || result.nodes.length === 0) {
        throw new Error('Could not extract any nodes from this source');
      }

      const newDiagram = createDiagram({
        title: result.title || 'Imported diagram',
        status: 'draft',
        nodes: result.nodes,
        connections: result.connections,
        suggestions: result.suggestions || [],
        importSource: result.sourceDetected,
        techIds: Array.from(
          new Set(
            result.nodes.map((n) => n.techId).filter((t): t is string => Boolean(t))
          )
        ),
      });

      loadVersion(result.nodes, result.connections, [], []);
      setSuggestions(result.suggestions || []);
      setDiagramTitle(newDiagram.title);

      onClose();
      router.push(`/diagram/${newDiagram.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-8 py-7 space-y-5">
      <div className="text-center">
        <h3 className="font-display text-2xl mb-1">
          Import an existing <span className="font-display-italic">diagram</span>
        </h3>
        <p className="text-xs text-[var(--muted)]">
          Drop a screenshot or paste in draw.io XML, Mermaid, or our JSON format.
          We&apos;ll extract the architecture for you.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDrop={onDropZone}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-[var(--hairline)] rounded-2xl p-6 text-center cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/30 transition"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.xml,.mermaid,.mmd,.json,.txt"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {imageDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageDataUrl}
            alt="Selected"
            className="max-h-40 mx-auto rounded-md border border-[var(--hairline)]"
          />
        ) : (
          <>
            <Upload size={22} className="text-[var(--muted)] mx-auto mb-2" />
            <div className="text-xs font-semibold mb-0.5">
              Drop a file or click to browse
            </div>
            <div className="text-[10px] text-[var(--muted)]">
              PNG · JPG · XML · Mermaid · JSON
            </div>
          </>
        )}
      </div>

      {/* Format tabs */}
      <div>
        <div className="flex items-center gap-1 bg-neutral-100 rounded-md p-0.5 mb-2">
          {FORMAT_TABS.map((f) => {
            const Icon = f.icon;
            const active = format === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={clsx(
                  'flex-1 inline-flex items-center justify-center gap-1 h-7 rounded text-[10px] font-mono font-semibold uppercase transition',
                  active ? 'bg-white shadow-sm text-[var(--foreground)]' : 'text-[var(--muted)]'
                )}
              >
                <Icon size={11} />
                {f.label}
              </button>
            );
          })}
        </div>
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setImageDataUrl(null);
            setImageBase64(null);
          }}
          rows={5}
          placeholder={
            format === 'mermaid'
              ? 'flowchart LR\n  Client --> API\n  API --> Database'
              : format === 'xml'
              ? 'Paste your draw.io XML here…'
              : format === 'json'
              ? '{ "title": "…", "nodes": [...], "connections": [...] }'
              : '…or paste anything (auto-detected)'
          }
          className="font-mono text-[11px]"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={busy || (!text.trim() && !imageBase64)}>
          {busy && <Loader2 size={14} className="animate-spin" />}
          {busy ? 'Importing…' : 'Detect & import'}
        </Button>
      </div>
    </div>
  );
}
