import { z } from 'zod';

// ─── Shared atoms ───────────────────────────────────────────────────────────

export const idSchema = z.string().min(1).max(64);
export type Id = z.infer<typeof idSchema>;

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().optional(),
  h: z.number().optional(),
});

// ─── Non-functional requirements ────────────────────────────────────────────

export const nfrKindSchema = z.enum([
  'latency',
  'throughput',
  'availability',
  'durability',
  'security',
  'cost',
  'compliance',
  'scalability',
  'observability',
]);

export const nfrSchema = z.object({
  id: idSchema,
  kind: nfrKindSchema,
  target: z.string(), // free-form, e.g. "p99 < 200ms", "99.95% monthly"
  rationale: z.string().optional(),
});

export type Nfr = z.infer<typeof nfrSchema>;

// ─── Components ─────────────────────────────────────────────────────────────

export const componentTypeSchema = z.enum([
  'service',
  'gateway',
  'queue',
  'cache',
  'db',
  'frontend',
  'job',
  'external',
  'library',
  'cdn',
  'auth',
  'monitor',
  'ml',
]);

export const apiContractSchema = z.object({
  id: idSchema,
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string(),
  description: z.string().optional(),
  requestSchema: z.string().optional(), // OpenAPI fragment as string
  responseSchema: z.string().optional(),
});

export const stateMachineTransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  on: z.string(), // event name
  guard: z.string().optional(),
});

export const stateMachineSchema = z.object({
  states: z.array(z.string()).min(1),
  initial: z.string(),
  transitions: z.array(stateMachineTransitionSchema),
});

export const componentSchema = z.object({
  id: idSchema,
  hldComponentId: idSchema.optional(), // LLD components reference their HLD parent
  name: z.string().min(1),
  type: componentTypeSchema,
  tech: z.string().optional(),
  responsibilities: z.array(z.string()).default([]),
  nfrIds: z.array(idSchema).default([]),
  apis: z.array(apiContractSchema).default([]),
  stateMachine: stateMachineSchema.optional(),
  position: positionSchema.optional(),
});

export type Component = z.infer<typeof componentSchema>;

// ─── Connections ────────────────────────────────────────────────────────────

export const connectionProtocolSchema = z.enum([
  'http',
  'grpc',
  'ws',
  'amqp',
  'kafka',
  'sql',
  'graphql',
  'sdk',
  'tcp',
  'udp',
]);

export const connectionSchema = z.object({
  id: idSchema,
  fromComponentId: idSchema,
  toComponentId: idSchema,
  protocol: connectionProtocolSchema,
  sync: z.enum(['sync', 'async']),
  dataFlow: z.string(),
  authMode: z.enum(['none', 'jwt', 'mTLS', 'oauth', 'apiKey']).optional(),
  retry: z
    .object({
      strategy: z.enum(['none', 'fixed', 'exponential']),
      maxAttempts: z.number().int().min(1).max(10),
    })
    .optional(),
});

export type Connection = z.infer<typeof connectionSchema>;

// ─── Data stores + ERD ──────────────────────────────────────────────────────

export const dataStoreKindSchema = z.enum([
  'rdbms',
  'document',
  'kv',
  'object',
  'search',
  'graph',
  'vector',
  'queue',
  'stream',
  'timeseries',
]);

export const erdColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
  nullable: z.boolean().default(false),
  pk: z.boolean().default(false),
  unique: z.boolean().default(false),
  references: z
    .object({ table: z.string(), column: z.string(), onDelete: z.string().optional() })
    .optional(),
});

export const erdTableSchema = z.object({
  name: z.string(),
  columns: z.array(erdColumnSchema),
  description: z.string().optional(),
});

export const indexDefSchema = z.object({
  name: z.string(),
  table: z.string(),
  columns: z.array(z.string()),
  unique: z.boolean().default(false),
});

export const dataStoreSchema = z.object({
  id: idSchema,
  hldDataStoreId: idSchema.optional(),
  name: z.string(),
  kind: dataStoreKindSchema,
  tech: z.string().optional(),
  tables: z.array(erdTableSchema).default([]),
  indexes: z.array(indexDefSchema).default([]),
});

export type DataStore = z.infer<typeof dataStoreSchema>;

// ─── External systems ──────────────────────────────────────────────────────

export const externalSystemSchema = z.object({
  id: idSchema,
  name: z.string(),
  vendor: z.string().optional(),
  description: z.string().optional(),
});

export type ExternalSystem = z.infer<typeof externalSystemSchema>;

// ─── Use cases + sequence diagrams ─────────────────────────────────────────

export const sequenceStepSchema = z.object({
  from: z.string(), // component or actor id
  to: z.string(),
  message: z.string(),
  type: z.enum(['call', 'return', 'async', 'note']).default('call'),
});

export const sequenceSchema = z.object({
  id: idSchema,
  useCaseId: idSchema,
  actors: z.array(z.string()).default([]), // ids referencing components or external 'user'
  steps: z.array(sequenceStepSchema),
});

export type Sequence = z.infer<typeof sequenceSchema>;

export const useCaseSchema = z.object({
  id: idSchema,
  name: z.string(),
  actor: z.string(),
  preconditions: z.array(z.string()).default([]),
  steps: z.array(z.string()).default([]),
  postconditions: z.array(z.string()).default([]),
  sequenceId: idSchema.optional(),
});

export type UseCase = z.infer<typeof useCaseSchema>;

// ─── Decisions (ADR-shaped) ─────────────────────────────────────────────────

export const decisionOptionSchema = z.object({
  name: z.string(),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
});

export const decisionSchema = z.object({
  id: idSchema,
  question: z.string(),
  options: z.array(decisionOptionSchema).min(1),
  chosen: z.string(), // matches one of options[].name
  rationale: z.string(),
  consequences: z.array(z.string()).default([]),
  sourceCitationIds: z.array(idSchema).default([]),
  status: z.enum(['Proposed', 'Accepted', 'Superseded']).default('Proposed'),
});

export type Decision = z.infer<typeof decisionSchema>;

// ─── Citations ─────────────────────────────────────────────────────────────

export const citationSchema = z.object({
  id: idSchema,
  url: z.string().url(),
  title: z.string(),
  snippet: z.string(),
  retrievedAt: z.string(), // ISO timestamp
});

export type Citation = z.infer<typeof citationSchema>;

// ─── Manual edits (preserved across regeneration) ──────────────────────────

export const manualEditSchema = z.object({
  id: idSchema,
  targetType: z.enum([
    'component',
    'connection',
    'datastore',
    'decision',
    'nfr',
    'externalSystem',
    'useCase',
  ]),
  targetId: idSchema,
  field: z.string(), // dot path; e.g. 'tech', 'name', 'position.x', 'responsibilities[2]'
  value: z.unknown(),
  pinned: z.boolean().default(true),
  editedBy: z.string(),
  editedAt: z.string(),
});

export type ManualEdit = z.infer<typeof manualEditSchema>;

// ─── Architecture (root) ───────────────────────────────────────────────────

export const architectureLevelSchema = z.enum(['HLD', 'LLD']);
export const architectureStateSchema = z.enum([
  'Draft',
  'InReview',
  'Approved',
  'Superseded',
]);

export const architectureSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  level: architectureLevelSchema,
  parentArchitectureId: idSchema.optional(),
  version: z.number().int().min(1),
  state: architectureStateSchema,
  title: z.string(),
  problemStatement: z.string(),
  nfrs: z.array(nfrSchema).default([]),
  components: z.array(componentSchema).default([]),
  connections: z.array(connectionSchema).default([]),
  dataStores: z.array(dataStoreSchema).default([]),
  externalSystems: z.array(externalSystemSchema).default([]),
  useCases: z.array(useCaseSchema).default([]),
  sequences: z.array(sequenceSchema).default([]),
  decisions: z.array(decisionSchema).default([]),
  citations: z.array(citationSchema).default([]),
  manualEdits: z.array(manualEditSchema).default([]),
  metadata: z.object({
    createdAt: z.string(),
    createdBy: z.string(),
    llmModel: z.string().optional(),
    generationCostUsd: z.number().optional(),
  }),
});

export type Architecture = z.infer<typeof architectureSchema>;
export type ArchitectureLevel = z.infer<typeof architectureLevelSchema>;
export type ArchitectureState = z.infer<typeof architectureStateSchema>;
