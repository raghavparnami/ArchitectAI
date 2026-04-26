import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import {
  DiagramNode,
  DiagramConnection,
  DiagramGroup,
  FreehandStroke,
  CanvasTool,
  CanvasState,
} from '@/lib/types';
import { sanitizeLabel, sanitizeEdgeLabel } from '@/lib/labels';

interface CanvasActions {
  setNodes: (nodes: DiagramNode[]) => void;
  addNode: (node: DiagramNode) => void;
  updateNode: (id: string, updates: Partial<DiagramNode>) => void;
  moveNode: (id: string, x: number, y: number) => void;
  deleteNode: (id: string) => void;
  setConnections: (connections: DiagramConnection[]) => void;
  addConnection: (connection: DiagramConnection) => void;
  updateConnection: (id: string, updates: Partial<DiagramConnection>) => void;
  deleteConnection: (id: string) => void;
  select: (ids: string[]) => void;
  selectConnection: (id: string | null) => void;
  clearSelection: () => void;
  toggleSelect: (id: string) => void;
  setTool: (tool: CanvasTool) => void;
  setConnectingFrom: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  addStroke: (stroke: FreehandStroke) => void;
  addGroup: (group: DiagramGroup) => void;
  updateGroup: (id: string, updates: Partial<DiagramGroup>) => void;
  deleteGroup: (id: string) => void;
  loadVersion: (
    nodes: DiagramNode[],
    connections: DiagramConnection[],
    groups: DiagramGroup[],
    strokes: FreehandStroke[]
  ) => void;
  markClean: () => void;
  reset: () => void;
  setSuggestions: (suggestions: string[]) => void;
  setDiagramTitle: (title: string) => void;
  moveGroup: (id: string, x: number, y: number) => void;
}

const initialState: CanvasState = {
  nodes: [],
  connections: [],
  groups: [],
  strokes: [],
  selectedIds: [],
  selectedConnectionId: null,
  tool: 'select',
  connectingFromId: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  isDirty: false,
  suggestions: [],
  diagramTitle: 'Untitled Diagram',
};

export const useCanvasStore = create<CanvasState & CanvasActions>()(
  temporal(
    immer((set) => ({
    ...initialState,

    setNodes: (nodes) =>
      set((s) => {
        s.nodes = nodes;
        s.isDirty = true;
      }),
    addNode: (node) =>
      set((s) => {
        s.nodes.push(node);
        s.isDirty = true;
      }),
    updateNode: (id, updates) =>
      set((s) => {
        const n = s.nodes.find((n) => n.id === id);
        if (n) Object.assign(n, updates);
        s.isDirty = true;
      }),
    moveNode: (id, x, y) =>
      set((s) => {
        const n = s.nodes.find((n) => n.id === id);
        if (n) {
          n.x = x;
          n.y = y;
        }
        s.isDirty = true;
      }),
    deleteNode: (id) =>
      set((s) => {
        s.nodes = s.nodes.filter((n) => n.id !== id);
        s.connections = s.connections.filter(
          (c) => c.fromNodeId !== id && c.toNodeId !== id
        );
        s.selectedIds = s.selectedIds.filter((sid) => sid !== id);
        s.isDirty = true;
      }),

    setConnections: (connections) =>
      set((s) => {
        s.connections = connections;
      }),
    addConnection: (connection) =>
      set((s) => {
        s.connections.push(connection);
        s.isDirty = true;
      }),
    updateConnection: (id, updates) =>
      set((s) => {
        const c = s.connections.find((c) => c.id === id);
        if (c) Object.assign(c, updates);
        s.isDirty = true;
      }),
    deleteConnection: (id) =>
      set((s) => {
        s.connections = s.connections.filter((c) => c.id !== id);
        s.selectedConnectionId = null;
        s.isDirty = true;
      }),

    select: (ids) =>
      set((s) => {
        s.selectedIds = ids;
        if (ids.length > 0) s.selectedConnectionId = null;
      }),
    selectConnection: (id) =>
      set((s) => {
        s.selectedConnectionId = id;
        if (id) s.selectedIds = [];
      }),
    clearSelection: () =>
      set((s) => {
        s.selectedIds = [];
        s.selectedConnectionId = null;
      }),
    toggleSelect: (id) =>
      set((s) => {
        const idx = s.selectedIds.indexOf(id);
        if (idx >= 0) s.selectedIds.splice(idx, 1);
        else s.selectedIds.push(id);
      }),

    setTool: (tool) =>
      set((s) => {
        s.tool = tool;
        s.connectingFromId = null;
      }),
    setConnectingFrom: (id) =>
      set((s) => {
        s.connectingFromId = id;
      }),

    setZoom: (zoom) =>
      set((s) => {
        s.zoom = Math.max(0.25, Math.min(3, zoom));
      }),
    setPan: (x, y) =>
      set((s) => {
        s.pan = { x, y };
      }),

    addStroke: (stroke) =>
      set((s) => {
        s.strokes.push(stroke);
        s.isDirty = true;
      }),

    addGroup: (group) =>
      set((s) => {
        s.groups.push(group);
        s.isDirty = true;
      }),
    updateGroup: (id, updates) =>
      set((s) => {
        const g = s.groups.find((g) => g.id === id);
        if (g) Object.assign(g, updates);
        s.isDirty = true;
      }),
    deleteGroup: (id) =>
      set((s) => {
        s.groups = s.groups.filter((g) => g.id !== id);
        s.isDirty = true;
      }),

    loadVersion: (nodes, connections, groups, strokes) =>
      set((s) => {
        // Sanitize labels at load time so old/imported diagrams clean up
        s.nodes = nodes.map((n) => ({ ...n, label: sanitizeLabel(n.label) }));
        s.connections = connections.map((c) => ({
          ...c,
          label: c.label ? sanitizeEdgeLabel(c.label) : c.label,
        }));
        s.groups = groups;
        s.strokes = strokes;
        s.isDirty = false;
        s.selectedIds = [];
        s.selectedConnectionId = null;
      }),
    markClean: () =>
      set((s) => {
        s.isDirty = false;
      }),
    reset: () => set(() => ({ ...initialState })),

    setSuggestions: (suggestions) =>
      set((s) => {
        s.suggestions = suggestions;
      }),
    setDiagramTitle: (title) =>
      set((s) => {
        s.diagramTitle = title;
      }),
    moveGroup: (id, x, y) =>
      set((s) => {
        const g = s.groups.find((g) => g.id === id);
        if (g) {
          g.x = x;
          g.y = y;
        }
        s.isDirty = true;
      }),
    })),
    {
      // Only undo node / connection / group changes — not selection or viewport
      partialize: (state) => ({
        nodes: state.nodes,
        connections: state.connections,
        groups: state.groups,
      }),
      limit: 100,
      equality: (a, b) =>
        JSON.stringify(a.nodes) === JSON.stringify(b.nodes) &&
        JSON.stringify(a.connections) === JSON.stringify(b.connections) &&
        JSON.stringify(a.groups) === JSON.stringify(b.groups),
    }
  )
);
