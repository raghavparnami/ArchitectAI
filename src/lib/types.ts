// ─── Tech catalog ───────────────────────────────────────────────────────────

export type TechCategory =
  | 'frontend' | 'backend' | 'database' | 'cache' | 'cloud'
  | 'infra' | 'messaging' | 'monitoring' | 'auth' | 'ai' | 'cdn' | 'search';

export interface TechItem {
  id: string;
  label: string;
  color: string;      // hex brand color
  abbr: string;       // 2-char abbreviation for the badge
  category: TechCategory;
  iconSlug?: string;  // SimpleIcons slug for logo fetching
}

// ─── Canvas primitives ───────────────────────────────────────────────────────

export type NodeType =
  | 'service' | 'database' | 'queue' | 'gateway' | 'frontend'
  | 'cache' | 'auth' | 'monitor' | 'cdn' | 'ml' | 'external'
  | 'shape' | 'entity';

export type NodeShape =
  | 'rect' | 'ellipse' | 'circle' | 'diamond' | 'hexagon'
  | 'parallelogram' | 'triangle' | 'cylinder' | 'cloud' | 'sticky';

export interface EntityField {
  name: string;
  type: string;
  pk?: boolean;
  fk?: boolean;
}

export interface DiagramNode {
  id: string;
  label: string;
  techId?: string;
  type: NodeType;
  shape?: NodeShape;       // visual shape; defaults to 'rect' (card)
  x: number;
  y: number;
  width?: number;
  height?: number;
  desc?: string;
  fields?: EntityField[];  // for entity (ER) nodes
  fill?: string;           // optional override for shape fill
  stroke?: string;         // optional override for shape stroke
  locked?: boolean;        // when true, drag/resize/delete are blocked
  z?: number;              // layer order, higher renders on top
  meta?: Record<string, string>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export type ImportSource = 'image' | 'xml' | 'mermaid' | 'json';

export type AssigneeRole = 'reviewer' | 'approver';

export interface Assignee {
  id: string;
  email: string;
  name?: string;
  role: AssigneeRole;
  addedAt: string;
}

export type Port = 'n' | 's' | 'e' | 'w';

export interface DiagramConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromPort: Port;
  toPort: Port;
  label?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface DiagramGroup {
  id: string;
  label: string;
  type: 'vpc' | 'k8s' | 'region' | 'zone' | 'generic';
  x: number;
  y: number;
  width: number;
  height: number;
  nodeIds: string[];
  color?: string;
}

export interface FreehandStroke {
  id: string;
  points: [number, number, number][];
  color: string;
  size: number;
}

export interface DiagramVersion {
  id: string;
  diagramId: string;
  versionNumber: number;
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  groups: DiagramGroup[];
  strokes: FreehandStroke[];
  createdBy: string;
  createdAt: string;
  changeNote?: string;
}

// ─── Diagram & workflow ──────────────────────────────────────────────────────

export type DiagramStatus = 'draft' | 'review' | 'approved' | 'rejected';

export type DiagramKind = 'architecture' | 'er';

export interface Diagram {
  id: string;
  orgId?: string;
  projectId?: string;
  authorId: string;
  title: string;
  kind?: DiagramKind;
  status: DiagramStatus;
  currentVersionId?: string;
  currentVersion?: DiagramVersion;
  techIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export type ApprovalAction = 'approved' | 'rejected' | 'changes_requested';

export interface Approval {
  id: string;
  diagramId: string;
  versionId: string;
  reviewerId: string;
  reviewerName: string;
  action: ApprovalAction;
  note?: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  diagramId: string;
  versionId?: string;
  nodeId?: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  body: string;
  parentId?: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  replies?: Comment[];
}

// ─── AI generation ───────────────────────────────────────────────────────────

export interface AIGenerationRequest {
  problemStatement: string;
  techStack: string[];
  orgInstructions?: string;
}

export interface AIGenerationResult {
  title: string;
  nodes: Omit<DiagramNode, 'id'>[];
  connections: Omit<DiagramConnection, 'id' | 'fromPort' | 'toPort'>[];
  suggestions: string[];
}

// ─── User & org ──────────────────────────────────────────────────────────────

export type UserRole = 'owner' | 'admin' | 'architect' | 'reviewer' | 'viewer';
export type Plan = 'free' | 'pro' | 'team' | 'enterprise';

export interface OrgMember {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
}

// ─── Canvas store state ───────────────────────────────────────────────────────

export type CanvasTool = 'select' | 'connect' | 'freehand' | 'pan';

export interface CanvasState {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  groups: DiagramGroup[];
  strokes: FreehandStroke[];
  selectedIds: string[];
  selectedConnectionId: string | null;
  tool: CanvasTool;
  connectingFromId: string | null;
  zoom: number;
  pan: { x: number; y: number };
  isDirty: boolean;
  suggestions: string[];
  diagramTitle: string;
}
