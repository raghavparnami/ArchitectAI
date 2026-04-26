'use client';
import {
  useRef,
  useEffect,
  useCallback,
  useState,
  MouseEvent as RM,
} from 'react';
import { useCanvasStore } from '@/stores/canvas.store';
import { CanvasNode } from './CanvasNode';
import { CanvasConnection } from './CanvasConnection';
import { CanvasGroup } from './CanvasGroup';
import { Toolbar } from './Toolbar';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { MiniMap } from './MiniMap';
import { SearchPalette } from './SearchPalette';
import {
  Copy,
  Clipboard as ClipboardIcon,
  Trash2,
  Lock,
  Unlock,
  Sparkles,
} from 'lucide-react';
import { toPng, toSvg } from 'html-to-image';
import {
  DiagramConnection,
  DiagramNode,
  NodeShape,
  Port,
} from '@/lib/types';
import {
  autoPorts,
  bezierPath,
  nodeCenter,
  portPosition,
} from '@/lib/canvas-utils';
import { TECH_CATALOG } from '@/lib/tech-catalog';

interface CanvasProps {
  diagramId: string;
  readOnly?: boolean;
  onSave?: (snapshot: {
    nodes: DiagramNode[];
    connections: DiagramConnection[];
    groups: import('@/lib/types').DiagramGroup[];
    strokes: import('@/lib/types').FreehandStroke[];
  }) => void;
}

const GRID = 20;
const snap = (v: number, on: boolean) => (on ? Math.round(v / GRID) * GRID : v);

export function Canvas({ diagramId, readOnly = false, onSave }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const nodes = useCanvasStore((s) => s.nodes);
  const connections = useCanvasStore((s) => s.connections);
  const groups = useCanvasStore((s) => s.groups);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const tool = useCanvasStore((s) => s.tool);
  const zoom = useCanvasStore((s) => s.zoom);
  const pan = useCanvasStore((s) => s.pan);
  const connectingFromId = useCanvasStore((s) => s.connectingFromId);
  const isDirty = useCanvasStore((s) => s.isDirty);

  const moveNode = useCanvasStore((s) => s.moveNode);
  const moveGroup = useCanvasStore((s) => s.moveGroup);
  const addNode = useCanvasStore((s) => s.addNode);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const selectConnection = useCanvasStore((s) => s.selectConnection);
  const selectedConnectionId = useCanvasStore((s) => s.selectedConnectionId);
  const select = useCanvasStore((s) => s.select);
  const toggleSelect = useCanvasStore((s) => s.toggleSelect);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const setConnectingFrom = useCanvasStore((s) => s.setConnectingFrom);
  const addConnection = useCanvasStore((s) => s.addConnection);
  const setTool = useCanvasStore((s) => s.setTool);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const setPan = useCanvasStore((s) => s.setPan);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const markClean = useCanvasStore((s) => s.markClean);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const clipboardRef = useRef<{
    nodes: DiagramNode[];
    connections: DiagramConnection[];
  } | null>(null);
  const dragRef = useRef<{
    nodeId: string;
    startX: number;
    startY: number;
    nodeStartX: number;
    nodeStartY: number;
    others: Map<string, { x: number; y: number }>;
    historyPaused: boolean;
  } | null>(null);
  const resizeRef = useRef<{
    nodeId: string;
    handle: 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startNodeX: number;
    startNodeY: number;
  } | null>(null);
  const marqueeRef = useRef<{
    startCanvasX: number;
    startCanvasY: number;
    additive: boolean;
    initialSelection: string[];
  } | null>(null);

  // Refs that mirror live state so the global mousemove listener can read
  // them without forcing a useEffect re-run (which would change deps length).
  const liveRef = useRef({ nodes, zoom, pan, moveNode, moveGroup, setPan, select });
  liveRef.current = { nodes, zoom, pan, moveNode, moveGroup, setPan, select };
  const groupDragRef = useRef<{
    groupId: string;
    startX: number;
    startY: number;
    groupStartX: number;
    groupStartY: number;
  } | null>(null);
  const groupResizeRef = useRef<{
    groupId: string;
    handle: 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startGroupX: number;
    startGroupY: number;
  } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const strokes = useCanvasStore((s) => s.strokes);

  // ─── Auto-save (debounced) ─────────────────────────────────────────────
  useEffect(() => {
    if (!isDirty || !onSave || readOnly) return;
    const t = setTimeout(() => {
      onSave({ nodes, connections, groups, strokes });
      markClean();
    }, 1500);
    return () => clearTimeout(t);
  }, [isDirty, nodes, connections, groups, strokes, onSave, readOnly, markClean]);

  // ─── Convert screen coords to canvas coords ───────────────────────────
  const toCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // ─── Node mousedown: drag OR finish a pending connection ───────────────
  const handleNodeMouseDown = useCallback(
    (e: RM, id: string) => {
      e.stopPropagation();

      // Finish a pending connection (started via handle or connect tool)
      if (connectingFromId && connectingFromId !== id) {
        const fromNode = nodes.find((n) => n.id === connectingFromId);
        const toNode = nodes.find((n) => n.id === id);
        if (fromNode && toNode) {
          const ports = autoPorts(fromNode, toNode);
          addConnection({
            id: `conn_${Date.now()}`,
            fromNodeId: connectingFromId,
            toNodeId: id,
            ...ports,
          });
        }
        setConnectingFrom(null);
        return;
      }

      // Connect tool: first click sets source
      if (tool === 'connect') {
        setConnectingFrom(id);
        return;
      }

      // Select
      if (e.shiftKey) toggleSelect(id);
      else if (!selectedIds.includes(id)) select([id]);

      // Begin drag — capture starting positions for ALL currently-selected nodes
      const node = nodes.find((n) => n.id === id);
      if (!node || node.locked) return;
      const groupSet = new Set<string>(
        selectedIds.includes(id) ? selectedIds : [id]
      );
      const others = new Map<string, { x: number; y: number }>();
      nodes.forEach((n) => {
        if (groupSet.has(n.id) && n.id !== id && !n.locked) {
          others.set(n.id, { x: n.x, y: n.y });
        }
      });
      // Pause history so the entire drag becomes ONE undo step
      useCanvasStore.temporal.getState().pause();
      dragRef.current = {
        nodeId: id,
        startX: e.clientX,
        startY: e.clientY,
        nodeStartX: node.x,
        nodeStartY: node.y,
        others,
        historyPaused: true,
      };
    },
    [tool, connectingFromId, nodes, selectedIds, addConnection, setConnectingFrom, select, toggleSelect]
  );

  // ─── Connect handle on a selected node ────────────────────────────────
  const handleConnectHandleMouseDown = useCallback(
    (e: RM, id: string, _port: Port) => {
      e.stopPropagation();
      setConnectingFrom(id);
    },
    [setConnectingFrom]
  );

  // ─── Resize handle on a selected node ─────────────────────────────────
  const handleResizeHandleMouseDown = useCallback(
    (e: RM, id: string, handle: 'nw' | 'ne' | 'sw' | 'se') => {
      e.stopPropagation();
      const node = nodes.find((n) => n.id === id);
      if (!node || node.locked) return;
      useCanvasStore.temporal.getState().pause();
      resizeRef.current = {
        nodeId: id,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startW: node.width ?? 140,
        startH: node.height ?? 80,
        startNodeX: node.x,
        startNodeY: node.y,
      };
    },
    [nodes]
  );

  // ─── Inline label edit ─────────────────────────────────────────────────
  const handleLabelChange = useCallback(
    (id: string, label: string) => {
      updateNode(id, { label });
    },
    [updateNode]
  );

  // ─── Drag-and-drop from palette ───────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-architect-palette')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData('application/x-architect-palette');
    if (!raw) return;
    e.preventDefault();
    let payload: {
      kind: 'tech' | 'generic' | 'shape' | 'entity';
      techId?: string;
      type?: string;
      label?: string;
      shape?: NodeShape;
    };
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    const pos = toCanvasCoords(e.clientX, e.clientY);

    if (payload.kind === 'tech' && payload.techId) {
      const tech = TECH_CATALOG.find((t) => t.id === payload.techId);
      if (!tech) return;
      addNode({
        id: `node_${Date.now()}`,
        label: tech.label,
        techId: tech.id,
        type: 'service',
        shape: 'rect',
        x: Math.round(pos.x - 70),
        y: Math.round(pos.y - 40),
        width: 140,
        height: 80,
        desc: '',
      });
    } else if (payload.kind === 'generic') {
      addNode({
        id: `node_${Date.now()}`,
        label: payload.label || 'Node',
        type: (payload.type as DiagramNode['type']) || 'service',
        shape: 'rect',
        x: Math.round(pos.x - 70),
        y: Math.round(pos.y - 40),
        width: 140,
        height: 80,
        desc: '',
      });
    } else if (payload.kind === 'shape' && payload.shape) {
      const isSticky = payload.shape === 'sticky';
      addNode({
        id: `node_${Date.now()}`,
        label: isSticky ? 'Note' : payload.label || labelForShape(payload.shape),
        type: 'shape',
        shape: payload.shape,
        x: Math.round(pos.x - (isSticky ? 80 : 70)),
        y: Math.round(pos.y - (isSticky ? 60 : 40)),
        width: isSticky ? 160 : 180,
        height: isSticky ? 120 : 96,
        fill: isSticky ? '#FEF3C7' : undefined,
        stroke: isSticky ? '#D97706' : undefined,
        desc: '',
      });
    } else if (payload.kind === 'entity') {
      addNode({
        id: `node_${Date.now()}`,
        label: payload.label || 'Entity',
        type: 'entity',
        shape: 'rect',
        x: Math.round(pos.x - 90),
        y: Math.round(pos.y - 50),
        width: 180,
        height: 100,
        fields: [
          { name: 'id', type: 'uuid', pk: true },
          { name: 'created_at', type: 'timestamp' },
        ],
      });
    }
  };

  // ─── Group drag start ─────────────────────────────────────────────────
  const handleGroupDragStart = useCallback(
    (e: RM, id: string) => {
      e.stopPropagation();
      const g = groups.find((g) => g.id === id);
      if (!g) return;
      groupDragRef.current = {
        groupId: id,
        startX: e.clientX,
        startY: e.clientY,
        groupStartX: g.x,
        groupStartY: g.y,
      };
    },
    [groups]
  );

  // ─── Group resize start ───────────────────────────────────────────────
  const handleGroupResizeStart = useCallback(
    (e: RM, id: string, handle: 'nw' | 'ne' | 'sw' | 'se') => {
      e.stopPropagation();
      const g = groups.find((g) => g.id === id);
      if (!g) return;
      useCanvasStore.temporal.getState().pause();
      groupResizeRef.current = {
        groupId: id,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startW: g.width,
        startH: g.height,
        startGroupX: g.x,
        startGroupY: g.y,
      };
    },
    [groups]
  );

  // ─── Global mousemove / mouseup (attached once; reads live state via ref) ─
  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      const live = liveRef.current;

      if (dragRef.current) {
        const d = dragRef.current;
        const dx = (e.clientX - d.startX) / live.zoom;
        const dy = (e.clientY - d.startY) / live.zoom;
        const snapOn = !e.shiftKey;
        live.moveNode(
          d.nodeId,
          snap(d.nodeStartX + dx, snapOn),
          snap(d.nodeStartY + dy, snapOn)
        );
        d.others.forEach((start, id) => {
          live.moveNode(id, snap(start.x + dx, snapOn), snap(start.y + dy, snapOn));
        });
      }
      if (resizeRef.current) {
        const r = resizeRef.current;
        const dx = (e.clientX - r.startX) / live.zoom;
        const dy = (e.clientY - r.startY) / live.zoom;
        const snapOn = !e.shiftKey;
        let nx = r.startNodeX;
        let ny = r.startNodeY;
        let nw = r.startW;
        let nh = r.startH;
        if (r.handle === 'se') {
          nw = Math.max(60, snap(r.startW + dx, snapOn));
          nh = Math.max(40, snap(r.startH + dy, snapOn));
        } else if (r.handle === 'sw') {
          nw = Math.max(60, snap(r.startW - dx, snapOn));
          nh = Math.max(40, snap(r.startH + dy, snapOn));
          nx = snap(r.startNodeX + dx, snapOn);
        } else if (r.handle === 'ne') {
          nw = Math.max(60, snap(r.startW + dx, snapOn));
          nh = Math.max(40, snap(r.startH - dy, snapOn));
          ny = snap(r.startNodeY + dy, snapOn);
        } else if (r.handle === 'nw') {
          nw = Math.max(60, snap(r.startW - dx, snapOn));
          nh = Math.max(40, snap(r.startH - dy, snapOn));
          nx = snap(r.startNodeX + dx, snapOn);
          ny = snap(r.startNodeY + dy, snapOn);
        }
        useCanvasStore.getState().updateNode(r.nodeId, { x: nx, y: ny, width: nw, height: nh });
      }
      if (marqueeRef.current) {
        const m = marqueeRef.current;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const curX = (e.clientX - rect.left - live.pan.x) / live.zoom;
        const curY = (e.clientY - rect.top - live.pan.y) / live.zoom;
        const x = Math.min(m.startCanvasX, curX);
        const y = Math.min(m.startCanvasY, curY);
        const w = Math.abs(curX - m.startCanvasX);
        const h = Math.abs(curY - m.startCanvasY);
        setMarquee({ x, y, w, h });

        const hit = live.nodes
          .filter((n) => {
            const nw = n.width ?? 140;
            const nh = n.height ?? 80;
            return n.x < x + w && n.x + nw > x && n.y < y + h && n.y + nh > y;
          })
          .map((n) => n.id);
        const next = m.additive
          ? Array.from(new Set([...m.initialSelection, ...hit]))
          : hit;
        live.select(next);
      }
      if (groupDragRef.current) {
        const g = groupDragRef.current;
        const dx = (e.clientX - g.startX) / live.zoom;
        const dy = (e.clientY - g.startY) / live.zoom;
        live.moveGroup(g.groupId, g.groupStartX + dx, g.groupStartY + dy);
      }
      if (groupResizeRef.current) {
        const g = groupResizeRef.current;
        const dx = (e.clientX - g.startX) / live.zoom;
        const dy = (e.clientY - g.startY) / live.zoom;
        let nx = g.startGroupX;
        let ny = g.startGroupY;
        let nw = g.startW;
        let nh = g.startH;
        if (g.handle === 'se') {
          nw = Math.max(120, g.startW + dx);
          nh = Math.max(80, g.startH + dy);
        } else if (g.handle === 'sw') {
          nw = Math.max(120, g.startW - dx);
          nh = Math.max(80, g.startH + dy);
          nx = g.startGroupX + dx;
        } else if (g.handle === 'ne') {
          nw = Math.max(120, g.startW + dx);
          nh = Math.max(80, g.startH - dy);
          ny = g.startGroupY + dy;
        } else if (g.handle === 'nw') {
          nw = Math.max(120, g.startW - dx);
          nh = Math.max(80, g.startH - dy);
          nx = g.startGroupX + dx;
          ny = g.startGroupY + dy;
        }
        useCanvasStore.getState().updateGroup(g.groupId, { x: nx, y: ny, width: nw, height: nh });
      }
      if (panRef.current) {
        const p = panRef.current;
        live.setPan(p.panX + (e.clientX - p.startX), p.panY + (e.clientY - p.startY));
      }
    };
    const onUp = () => {
      if (dragRef.current?.historyPaused) {
        useCanvasStore.temporal.getState().resume();
      }
      if (resizeRef.current || groupResizeRef.current) {
        useCanvasStore.temporal.getState().resume();
      }
      dragRef.current = null;
      resizeRef.current = null;
      groupDragRef.current = null;
      groupResizeRef.current = null;
      panRef.current = null;
      marqueeRef.current = null;
      setMarquee(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // ─── Right-click context menu ─────────────────────────────────────────
  const openContextMenu = (e: React.MouseEvent, nodeId?: string) => {
    e.preventDefault();
    e.stopPropagation();

    const ids = nodeId
      ? selectedIds.includes(nodeId)
        ? selectedIds
        : [nodeId]
      : selectedIds;

    if (nodeId && !selectedIds.includes(nodeId)) {
      select([nodeId]);
    }

    const liveNodes = liveRef.current.nodes;
    const onNode = ids.length > 0;
    const allLocked = onNode && ids.every((id) => liveNodes.find((n) => n.id === id)?.locked);

    const items: ContextMenuItem[] = onNode
      ? [
          {
            label: 'Copy',
            shortcut: '⌘C',
            icon: <Copy size={12} />,
            onClick: copySelected,
          },
          {
            label: 'Duplicate',
            shortcut: '⌘D',
            icon: <Copy size={12} />,
            onClick: () => {
              copySelected();
              pasteClipboard();
            },
          },
          {
            label: allLocked ? 'Unlock' : 'Lock',
            icon: allLocked ? <Unlock size={12} /> : <Lock size={12} />,
            onClick: () => {
              ids.forEach((id) => {
                const n = liveRef.current.nodes.find((nn) => nn.id === id);
                useCanvasStore.getState().updateNode(id, { locked: !n?.locked });
              });
            },
          },
          { label: '', divider: true, onClick: () => {} },
          {
            label: 'Delete',
            shortcut: '⌫',
            icon: <Trash2 size={12} />,
            danger: true,
            onClick: () => ids.forEach(deleteNode),
          },
        ]
      : [
          {
            label: 'Paste',
            shortcut: '⌘V',
            icon: <ClipboardIcon size={12} />,
            onClick: () => pasteClipboard(),
          },
          {
            label: 'Select all',
            shortcut: '⌘A',
            icon: <Sparkles size={12} />,
            onClick: () => select(liveRef.current.nodes.map((n) => n.id)),
          },
        ];

    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  // ─── Fit to screen ────────────────────────────────────────────────────
  const fitToScreen = useCallback(() => {
    const ns = liveRef.current.nodes;
    if (ns.length === 0 || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 80;
    const xs = ns.map((n) => n.x);
    const ys = ns.map((n) => n.y);
    const minX = Math.min(...xs) - padding;
    const minY = Math.min(...ys) - padding;
    const maxX = Math.max(...ns.map((n) => n.x + (n.width ?? 140))) + padding;
    const maxY = Math.max(...ns.map((n) => n.y + (n.height ?? 80))) + padding;
    const w = maxX - minX;
    const h = maxY - minY;
    const z = Math.min(rect.width / w, rect.height / h, 2);
    setZoom(z);
    setPan(-minX * z + (rect.width - w * z) / 2, -minY * z + (rect.height - h * z) / 2);
  }, [setZoom, setPan]);

  // ─── Export PNG / SVG ─────────────────────────────────────────────────
  const exportDiagram = useCallback(
    async (format: 'png' | 'svg') => {
      const target = containerRef.current?.querySelector('[data-canvas-export]') as HTMLElement | null;
      if (!target) return;
      // Save view, fit to screen, capture, restore
      const live = liveRef.current;
      const oldZoom = live.zoom;
      const oldPan = { ...live.pan };
      fitToScreen();
      await new Promise((r) => setTimeout(r, 60));
      try {
        const opts = {
          backgroundColor: '#FBFAF6',
          pixelRatio: 2,
          cacheBust: true,
          filter: (node: HTMLElement) => {
            // Skip the toolbar/minimap UI, only include the canvas content
            const cl = (node as HTMLElement).className;
            if (typeof cl === 'string') {
              if (cl.includes('canvas-ui-overlay')) return false;
            }
            return true;
          },
        };
        const dataUrl = format === 'png' ? await toPng(target, opts) : await toSvg(target, opts);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `architecture.${format}`;
        a.click();
      } catch (err) {
        console.error('export failed', err);
      } finally {
        setZoom(oldZoom);
        setPan(oldPan.x, oldPan.y);
      }
    },
    [fitToScreen, setZoom, setPan]
  );

  // ─── Background interactions ──────────────────────────────────────────
  const handleBackgroundMouseDown = (e: RM) => {
    // Pan: middle-click, pan tool, or Alt+left-drag
    if (e.button === 1 || tool === 'pan' || (e.button === 0 && e.altKey)) {
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      return;
    }

    if (connectingFromId) {
      setConnectingFrom(null);
      return;
    }

    // Begin marquee selection
    const start = toCanvasCoords(e.clientX, e.clientY);
    marqueeRef.current = {
      startCanvasX: start.x,
      startCanvasY: start.y,
      additive: e.shiftKey,
      initialSelection: e.shiftKey ? [...selectedIds] : [],
    };
    setMarquee({ x: start.x, y: start.y, w: 0, h: 0 });

    if (!e.shiftKey) clearSelection();
  };

  // ─── Wheel zoom ───────────────────────────────────────────────────────
  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setZoom(zoom + delta);
  };

  // ─── Copy / paste / duplicate ─────────────────────────────────────────
  const copySelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const set = new Set(selectedIds);
    const copyNodes = nodes.filter((n) => set.has(n.id));
    const copyConns = connections.filter(
      (c) => set.has(c.fromNodeId) && set.has(c.toNodeId)
    );
    clipboardRef.current = {
      nodes: JSON.parse(JSON.stringify(copyNodes)),
      connections: JSON.parse(JSON.stringify(copyConns)),
    };
  }, [selectedIds, nodes, connections]);

  const pasteClipboard = useCallback(
    (offsetX = 24, offsetY = 24) => {
      const clip = clipboardRef.current;
      if (!clip || clip.nodes.length === 0) return;
      const stamp = Date.now();
      const idMap = new Map<string, string>();
      const newNodes = clip.nodes.map((n, i) => {
        const newId = `node_${stamp}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        idMap.set(n.id, newId);
        return { ...n, id: newId, x: n.x + offsetX, y: n.y + offsetY };
      });
      const newConns = clip.connections.map((c, i) => ({
        ...c,
        id: `conn_${stamp}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        fromNodeId: idMap.get(c.fromNodeId) ?? c.fromNodeId,
        toNodeId: idMap.get(c.toNodeId) ?? c.toNodeId,
      }));
      newNodes.forEach((n) => addNode(n));
      newConns.forEach((c) => addConnection(c));
      select(newNodes.map((n) => n.id));
    },
    [addNode, addConnection, select]
  );

  // ─── Keyboard ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const meta = e.metaKey || e.ctrlKey;

      // Copy / paste / duplicate (must be checked before plain c/v tool shortcuts)
      if (meta && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        copySelected();
        return;
      }
      if (meta && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if (meta && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        copySelected();
        // Defer paste so the copy state is committed before reading from ref
        pasteClipboard();
        return;
      }
      if (meta && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        select(nodes.map((n) => n.id));
        return;
      }
      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      // Undo / redo
      if (meta && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        useCanvasStore.temporal.getState().undo();
        return;
      }
      if (meta && (e.shiftKey && (e.key === 'z' || e.key === 'Z') || (e.key === 'y' || e.key === 'Y'))) {
        e.preventDefault();
        useCanvasStore.temporal.getState().redo();
        return;
      }

      if (e.key === 'Escape') {
        setConnectingFrom(null);
        clearSelection();
        setContextMenu(null);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          // Skip locked nodes
          const liveNodes = liveRef.current.nodes;
          selectedIds.forEach((id) => {
            const n = liveNodes.find((nn) => nn.id === id);
            if (!n?.locked) deleteNode(id);
          });
        }
      }
      // Arrow nudge
      if (!meta && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        if (selectedIds.length === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const liveNodes = liveRef.current.nodes;
        selectedIds.forEach((id) => {
          const n = liveNodes.find((nn) => nn.id === id);
          if (n && !n.locked) {
            useCanvasStore.getState().moveNode(id, n.x + dx, n.y + dy);
          }
        });
        return;
      }
      // Plain tool shortcuts only when NO modifier key is held
      if (!meta && !e.shiftKey && !e.altKey) {
        if (e.key === 'v') setTool('select');
        if (e.key === 'c') setTool('connect');
        if (e.key === 'h') setTool('pan');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    readOnly,
    selectedIds,
    nodes,
    deleteNode,
    clearSelection,
    setConnectingFrom,
    setTool,
    copySelected,
    pasteClipboard,
    select,
  ]);

  // ─── Live preview line for active connection ─────────────────────────
  let previewPath: string | null = null;
  if (connectingFromId) {
    const from = nodes.find((n) => n.id === connectingFromId);
    if (from) {
      const center = nodeCenter(from);
      const target = toCanvasCoords(mousePos.x, mousePos.y);
      previewPath = bezierPath(center, target, 's', 'n');
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-neutral-100"
      onMouseDown={handleBackgroundMouseDown}
      onContextMenu={(e) => openContextMenu(e)}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ cursor: tool === 'pan' ? 'grab' : undefined }}
    >
      <div className="canvas-ui-overlay">
        <Toolbar onFitToScreen={fitToScreen} onExport={exportDiagram} />
      </div>

      <div
        data-canvas-export
        className="absolute top-0 left-0 origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: 4000,
          height: 3000,
        }}
      >
        {/* SVG layer: grid + connections */}
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          width={4000}
          height={3000}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="#D8D2C2" />
            </pattern>
            <marker
              id="arrowhead-strong"
              viewBox="0 0 12 12"
              refX="10"
              refY="6"
              markerWidth="9"
              markerHeight="9"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 12 6 L 0 12 L 3 6 z" fill="#3F3A33" />
            </marker>
            <marker
              id="arrowhead-strong-selected"
              viewBox="0 0 12 12"
              refX="10"
              refY="6"
              markerWidth="9"
              markerHeight="9"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 12 6 L 0 12 L 3 6 z" fill="#C7521B" />
            </marker>
          </defs>
          <rect width={4000} height={3000} fill="url(#grid)" />

          <g style={{ pointerEvents: 'auto' }}>
            {connections.map((c) => {
              const from = nodes.find((n) => n.id === c.fromNodeId);
              const to = nodes.find((n) => n.id === c.toNodeId);
              if (!from || !to) return null;
              return (
                <CanvasConnection
                  key={c.id}
                  connection={c}
                  fromNode={from}
                  toNode={to}
                  selected={selectedConnectionId === c.id}
                  onClick={(id) => selectConnection(id)}
                />
              );
            })}
          </g>

          {previewPath && (
            <path
              d={previewPath}
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="none"
            />
          )}

          {/* Marquee rectangle */}
          {marquee && (
            <rect
              x={marquee.x}
              y={marquee.y}
              width={marquee.w}
              height={marquee.h}
              fill="#C7521B"
              fillOpacity={0.08}
              stroke="#C7521B"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          )}
        </svg>

        {/* Group layer (behind nodes) */}
        {groups.map((g) => (
          <CanvasGroup
            key={g.id}
            group={g}
            readOnly={readOnly}
            onDragStart={handleGroupDragStart}
            onResizeStart={handleGroupResizeStart}
          />
        ))}

        {/* Node layer */}
        {nodes.map((n) => (
          <CanvasNode
            key={n.id}
            node={n}
            selected={selectedIds.includes(n.id)}
            isConnectingSource={connectingFromId === n.id}
            readOnly={readOnly}
            onMouseDown={handleNodeMouseDown}
            onHandleMouseDown={handleConnectHandleMouseDown}
            onResizeHandleMouseDown={handleResizeHandleMouseDown}
            onLabelChange={handleLabelChange}
            onContextMenu={(e) => openContextMenu(e, n.id)}
          />
        ))}
      </div>

      <div className="canvas-ui-overlay">
        <MiniMap />
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-neutral-400">
            <div className="text-sm">Empty canvas</div>
            <div className="text-xs mt-1">
              Drag a shape from the palette, or use the wizard
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function labelForShape(shape: NodeShape): string {
  return shape.charAt(0).toUpperCase() + shape.slice(1);
}
