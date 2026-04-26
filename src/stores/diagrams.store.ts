'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Assignee,
  ChatMessage,
  Diagram,
  DiagramConnection,
  DiagramGroup,
  DiagramNode,
  DiagramStatus,
  FreehandStroke,
  ImportSource,
  Project,
} from '@/lib/types';

/**
 * StoredDiagram = Diagram metadata + the canvas snapshot inlined.
 * For enterprise persistence we'd split this into a `diagrams` table and
 * a `diagram_versions` table; for the localStorage MVP we store the head
 * snapshot directly on the diagram and bump `updatedAt` whenever it changes.
 */
export interface StoredDiagram extends Diagram {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  groups: DiagramGroup[];
  strokes: FreehandStroke[];
  suggestions: string[];
  messages?: ChatMessage[];
  importSource?: ImportSource | null;
  assignees?: Assignee[];
}

interface DiagramsStore {
  diagrams: StoredDiagram[];
  projects: Project[];
  hasHydrated: boolean;
  _setHydrated: (h: boolean) => void;

  createDiagram: (data?: Partial<StoredDiagram>) => StoredDiagram;
  updateDiagram: (id: string, patch: Partial<StoredDiagram>) => void;
  updateSnapshot: (
    id: string,
    snapshot: Partial<Pick<StoredDiagram, 'nodes' | 'connections' | 'groups' | 'strokes' | 'suggestions' | 'title' | 'techIds'>>
  ) => void;
  deleteDiagram: (id: string) => void;
  setStatus: (id: string, status: DiagramStatus) => void;
  getDiagram: (id: string) => StoredDiagram | undefined;

  createProject: (name: string, color: string) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  assignToProject: (diagramId: string, projectId?: string) => void;

  addAssignee: (diagramId: string, assignee: Omit<Assignee, 'id' | 'addedAt'>) => void;
  removeAssignee: (diagramId: string, assigneeId: string) => void;
}

const newId = () =>
  `dgm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const useDiagramsStore = create<DiagramsStore>()(
  persist(
    (set, get) => ({
      diagrams: [],
      projects: [],
      hasHydrated: false,
      _setHydrated: (h) => set({ hasHydrated: h }),

      createProject: (name, color) => {
        const p: Project = {
          id: `prj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name,
          color,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ projects: [p, ...s.projects] }));
        return p;
      },
      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      deleteProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          diagrams: s.diagrams.map((d) =>
            d.projectId === id ? { ...d, projectId: undefined } : d
          ),
        })),
      assignToProject: (diagramId, projectId) =>
        set((s) => ({
          diagrams: s.diagrams.map((d) =>
            d.id === diagramId
              ? { ...d, projectId, updatedAt: new Date().toISOString() }
              : d
          ),
        })),

      addAssignee: (diagramId, assignee) =>
        set((s) => ({
          diagrams: s.diagrams.map((d) => {
            if (d.id !== diagramId) return d;
            const existing = d.assignees ?? [];
            // Skip duplicates by email + role
            if (existing.some((a) => a.email === assignee.email && a.role === assignee.role)) {
              return d;
            }
            const newAssignee: Assignee = {
              ...assignee,
              id: `asg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              addedAt: new Date().toISOString(),
            };
            return {
              ...d,
              assignees: [...existing, newAssignee],
              updatedAt: new Date().toISOString(),
            };
          }),
        })),
      removeAssignee: (diagramId, assigneeId) =>
        set((s) => ({
          diagrams: s.diagrams.map((d) =>
            d.id === diagramId
              ? {
                  ...d,
                  assignees: (d.assignees ?? []).filter((a) => a.id !== assigneeId),
                  updatedAt: new Date().toISOString(),
                }
              : d
          ),
        })),

      createDiagram: (data = {}) => {
        const now = new Date().toISOString();
        const draft: StoredDiagram = {
          id: newId(),
          authorId: 'current_user',
          title: 'Untitled Diagram',
          status: 'draft',
          techIds: [],
          nodes: [],
          connections: [],
          groups: [],
          strokes: [],
          suggestions: [],
          createdAt: now,
          updatedAt: now,
          ...data,
        };
        set((s) => ({ diagrams: [draft, ...s.diagrams] }));
        return draft;
      },

      updateDiagram: (id, patch) =>
        set((s) => ({
          diagrams: s.diagrams.map((d) =>
            d.id === id
              ? { ...d, ...patch, updatedAt: new Date().toISOString() }
              : d
          ),
        })),

      updateSnapshot: (id, snapshot) =>
        set((s) => ({
          diagrams: s.diagrams.map((d) =>
            d.id === id
              ? {
                  ...d,
                  ...snapshot,
                  techIds:
                    snapshot.techIds ??
                    Array.from(
                      new Set(
                        (snapshot.nodes ?? d.nodes)
                          .map((n) => n.techId)
                          .filter((t): t is string => Boolean(t))
                      )
                    ),
                  updatedAt: new Date().toISOString(),
                }
              : d
          ),
        })),

      deleteDiagram: (id) =>
        set((s) => ({ diagrams: s.diagrams.filter((d) => d.id !== id) })),

      setStatus: (id, status) =>
        set((s) => ({
          diagrams: s.diagrams.map((d) =>
            d.id === id
              ? { ...d, status, updatedAt: new Date().toISOString() }
              : d
          ),
        })),

      getDiagram: (id) => get().diagrams.find((d) => d.id === id),
    }),
    {
      name: 'architectai-diagrams-v1',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') return window.localStorage;
        return {
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined,
        };
      }),
      partialize: (state) => ({ diagrams: state.diagrams, projects: state.projects }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated(true);
      },
    }
  )
);
