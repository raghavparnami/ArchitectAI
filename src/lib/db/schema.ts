import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from 'drizzle-orm/pg-core';
import type { Architecture } from '@/lib/architecture/schema';

export const archLevel = pgEnum('arch_level', ['HLD', 'LLD']);
export const archState = pgEnum('arch_state', [
  'Draft',
  'InReview',
  'Approved',
  'Superseded',
]);
export const decisionStatus = pgEnum('decision_status', [
  'Proposed',
  'Accepted',
  'Superseded',
]);
export const reviewDecision = pgEnum('review_decision', [
  'approved',
  'rejected',
  'changes_requested',
]);
export const llmProvider = pgEnum('llm_provider', [
  'anthropic',
  'openai',
  'google',
  'custom',
]);
export const artifactKind = pgEnum('artifact_kind', [
  'rs',
  'ds-hld',
  'ds-lld',
  'adr',
  'jira',
  'code',
]);
export const memberRole = pgEnum('member_role', [
  'owner',
  'admin',
  'architect',
  'reviewer',
  'viewer',
]);
export const editTargetType = pgEnum('edit_target_type', [
  'component',
  'connection',
  'datastore',
  'decision',
  'nfr',
  'externalSystem',
  'useCase',
]);

// ─── Users mirror Clerk; we keep a row per user so we can FK from
//     workspace_members, projects.owner_id, etc. without joining Clerk.
export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user_id
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  defaultWorkspaceId: text('default_workspace_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workspaces = pgTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    clerkOrgId: text('clerk_org_id').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('workspaces_clerk_org_id_idx').on(t.clerkOrgId)]
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRole('role').notNull().default('viewer'),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })]
);

export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    problemStatement: text('problem_statement'),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [index('projects_workspace_idx').on(t.workspaceId)]
);

// canonical jsonb stores the full Architecture object; we duplicate a few
// hot fields (state, level, version, title) at the column level for query
// performance. See lib/architecture/schema.ts for the canonical shape.
export const architectures = pgTable(
  'architectures',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    level: archLevel('level').notNull(),
    parentArchitectureId: text('parent_architecture_id'),
    version: integer('version').notNull(),
    state: archState('state').notNull().default('Draft'),
    title: text('title').notNull(),
    canonical: jsonb('canonical').$type<Architecture>().notNull(),
    llmModel: text('llm_model'),
    generationCostUsd: text('generation_cost_usd'), // numeric stored as text to avoid JS float drift
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    uniqueIndex('architectures_project_level_version_idx').on(
      t.projectId,
      t.level,
      t.version
    ),
    index('architectures_parent_idx').on(t.parentArchitectureId),
  ]
);

// Decisions are denormalized from canonical for queryability (ADR list views).
export const decisions = pgTable(
  'decisions',
  {
    id: text('id').primaryKey(),
    architectureId: text('architecture_id')
      .notNull()
      .references(() => architectures.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    chosen: text('chosen').notNull(),
    rationale: text('rationale').notNull(),
    status: decisionStatus('status').notNull().default('Proposed'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('decisions_architecture_idx').on(t.architectureId)]
);

export const manualEdits = pgTable(
  'manual_edits',
  {
    id: text('id').primaryKey(),
    architectureId: text('architecture_id')
      .notNull()
      .references(() => architectures.id, { onDelete: 'cascade' }),
    targetType: editTargetType('target_type').notNull(),
    targetId: text('target_id').notNull(),
    field: text('field').notNull(),
    value: jsonb('value').notNull(),
    pinned: boolean('pinned').notNull().default(true),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('manual_edits_architecture_idx').on(t.architectureId),
    index('manual_edits_target_idx').on(t.targetType, t.targetId),
  ]
);

// pgvector for "find prior decisions on similar problems"
export const citations = pgTable(
  'citations',
  {
    id: text('id').primaryKey(),
    architectureId: text('architecture_id')
      .notNull()
      .references(() => architectures.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    title: text('title').notNull(),
    snippet: text('snippet').notNull(),
    // 1536 = text-embedding-3-small / OpenAI default. Override if you switch
    // embedding provider — drizzle's vector dimension is fixed at the schema.
    embedding: vector('embedding', { dimensions: 1536 }),
    retrievedAt: timestamp('retrieved_at', { withTimezone: true }).defaultNow().notNull(),
    usedInDecisionId: text('used_in_decision_id').references(() => decisions.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    index('citations_architecture_idx').on(t.architectureId),
    // ivfflat index added in raw SQL migration — drizzle-kit can't emit it yet.
  ]
);

export const userLlmKeys = pgTable(
  'user_llm_keys',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: llmProvider('provider').notNull(),
    label: text('label').notNull(),
    // libsodium secretbox ciphertext + nonce, base64-encoded so we don't
    // depend on driver-specific bytea handling.
    encryptedKey: text('encrypted_key').notNull(),
    nonce: text('nonce').notNull(),
    baseUrl: text('base_url'), // for provider='custom'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('user_llm_keys_user_provider_label_idx').on(
      t.userId,
      t.provider,
      t.label
    ),
  ]
);

export const reviews = pgTable(
  'reviews',
  {
    id: text('id').primaryKey(),
    architectureId: text('architecture_id')
      .notNull()
      .references(() => architectures.id, { onDelete: 'cascade' }),
    reviewerId: text('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    decision: reviewDecision('decision').notNull(),
    comments: text('comments'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('reviews_architecture_idx').on(t.architectureId)]
);

export const generatedArtifacts = pgTable(
  'generated_artifacts',
  {
    id: text('id').primaryKey(),
    architectureId: text('architecture_id')
      .notNull()
      .references(() => architectures.id, { onDelete: 'cascade' }),
    kind: artifactKind('kind').notNull(),
    storagePath: text('storage_path').notNull(),
    contentHash: text('content_hash').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('generated_artifacts_architecture_idx').on(t.architectureId),
    uniqueIndex('generated_artifacts_kind_hash_idx').on(
      t.architectureId,
      t.kind,
      t.contentHash
    ),
  ]
);

// Re-export the SQL helper so downstream code that mixes Drizzle queries with
// raw SQL fragments doesn't need a separate import.
export { sql };
