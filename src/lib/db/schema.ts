import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import type { Architecture } from '@/lib/architecture/schema';

// ─── Enum-like literal unions (SQLite has no native enum type) ──────────────
//
// We declare these as TS const tuples so drizzle's `text({ enum })` gives
// us compile-time + insert-time type narrowing. Adding a new value means
// editing here AND deciding whether existing rows need a backfill.

const ARCH_LEVELS = ['HLD', 'LLD'] as const;
const ARCH_STATES = ['Draft', 'InReview', 'Approved', 'Superseded'] as const;
const DECISION_STATUSES = ['Proposed', 'Accepted', 'Superseded'] as const;
const REVIEW_DECISIONS = ['approved', 'rejected', 'changes_requested'] as const;
const LLM_PROVIDERS = ['anthropic', 'openai', 'google', 'custom'] as const;
const ARTIFACT_KINDS = ['rs', 'ds-hld', 'ds-lld', 'adr', 'jira', 'code'] as const;
const MEMBER_ROLES = [
  'owner',
  'admin',
  'architect',
  'reviewer',
  'viewer',
] as const;
const EDIT_TARGET_TYPES = [
  'component',
  'connection',
  'datastore',
  'decision',
  'nfr',
  'externalSystem',
  'useCase',
] as const;

// Timestamps: store as ms-precision Unix epoch integers. Drizzle's
// `timestamp_ms` mode hands us Date objects on read and converts back
// transparently on write — same DX as Postgres `timestamp`.
const tsNow = sql`(unixepoch() * 1000)`;

// ─── Users mirror Clerk; one row per user we've seen so we can FK from
//     workspace_members, projects.owner_id, etc. without joining Clerk.

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // Clerk user_id
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  defaultWorkspaceId: text('default_workspace_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(tsNow),
});

export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    clerkOrgId: text('clerk_org_id').notNull(),
    name: text('name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(tsNow),
  },
  (t) => ({
    clerkOrgIdIdx: uniqueIndex('workspaces_clerk_org_id_idx').on(t.clerkOrgId),
  })
);

export const workspaceMembers = sqliteTable(
  'workspace_members',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: MEMBER_ROLES }).notNull().default('viewer'),
    addedAt: integer('added_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(tsNow),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.workspaceId, t.userId] }),
  })
);

export const projects = sqliteTable(
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(tsNow),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
  },
  (t) => ({
    workspaceIdx: index('projects_workspace_idx').on(t.workspaceId),
  })
);

// `canonical` stores the full Architecture object as JSON-serialized text.
// `text({ mode: 'json' })` round-trips through JSON.parse/stringify and
// the `.$type<>()` annotation gives us nominal typing on read.
export const architectures = sqliteTable(
  'architectures',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    level: text('level', { enum: ARCH_LEVELS }).notNull(),
    parentArchitectureId: text('parent_architecture_id'),
    version: integer('version').notNull(),
    state: text('state', { enum: ARCH_STATES }).notNull().default('Draft'),
    title: text('title').notNull(),
    canonical: text('canonical', { mode: 'json' })
      .$type<Architecture>()
      .notNull(),
    llmModel: text('llm_model'),
    // SQLite has no decimal type. Store cost as text for exact arithmetic
    // (e.g. "0.0231"); use Number() at read time when summing.
    generationCostUsd: text('generation_cost_usd'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(tsNow),
    approvedAt: integer('approved_at', { mode: 'timestamp_ms' }),
    approvedBy: text('approved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => ({
    projectLevelVersionIdx: uniqueIndex(
      'architectures_project_level_version_idx'
    ).on(t.projectId, t.level, t.version),
    parentIdx: index('architectures_parent_idx').on(t.parentArchitectureId),
  })
);

export const decisions = sqliteTable(
  'decisions',
  {
    id: text('id').primaryKey(),
    architectureId: text('architecture_id')
      .notNull()
      .references(() => architectures.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    chosen: text('chosen').notNull(),
    rationale: text('rationale').notNull(),
    status: text('status', { enum: DECISION_STATUSES })
      .notNull()
      .default('Proposed'),
    position: integer('position').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(tsNow),
  },
  (t) => ({
    architectureIdx: index('decisions_architecture_idx').on(t.architectureId),
  })
);

export const manualEdits = sqliteTable(
  'manual_edits',
  {
    id: text('id').primaryKey(),
    architectureId: text('architecture_id')
      .notNull()
      .references(() => architectures.id, { onDelete: 'cascade' }),
    targetType: text('target_type', { enum: EDIT_TARGET_TYPES }).notNull(),
    targetId: text('target_id').notNull(),
    field: text('field').notNull(),
    value: text('value', { mode: 'json' }).notNull(),
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(true),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(tsNow),
  },
  (t) => ({
    architectureIdx: index('manual_edits_architecture_idx').on(
      t.architectureId
    ),
    targetIdx: index('manual_edits_target_idx').on(t.targetType, t.targetId),
  })
);

// Citations live without embeddings on SQLite — pgvector isn't available
// in vanilla SQLite. When we want semantic recall later, options:
//   1. Switch to libSQL (Turso) which has sqlite-vec via extension.
//   2. Store embeddings as JSON arrays and do cosine search in-memory.
//   3. Migrate this table to Postgres + pgvector (revert M0 schema).
export const citations = sqliteTable(
  'citations',
  {
    id: text('id').primaryKey(),
    architectureId: text('architecture_id')
      .notNull()
      .references(() => architectures.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    title: text('title').notNull(),
    snippet: text('snippet').notNull(),
    retrievedAt: integer('retrieved_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(tsNow),
    usedInDecisionId: text('used_in_decision_id').references(
      () => decisions.id,
      { onDelete: 'set null' }
    ),
  },
  (t) => ({
    architectureIdx: index('citations_architecture_idx').on(t.architectureId),
  })
);

export const userLlmKeys = sqliteTable(
  'user_llm_keys',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider', { enum: LLM_PROVIDERS }).notNull(),
    label: text('label').notNull(),
    // libsodium secretbox ciphertext + nonce, base64-encoded.
    encryptedKey: text('encrypted_key').notNull(),
    nonce: text('nonce').notNull(),
    baseUrl: text('base_url'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(tsNow),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
  },
  (t) => ({
    userProviderLabelIdx: uniqueIndex(
      'user_llm_keys_user_provider_label_idx'
    ).on(t.userId, t.provider, t.label),
  })
);

export const reviews = sqliteTable(
  'reviews',
  {
    id: text('id').primaryKey(),
    architectureId: text('architecture_id')
      .notNull()
      .references(() => architectures.id, { onDelete: 'cascade' }),
    reviewerId: text('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    decision: text('decision', { enum: REVIEW_DECISIONS }).notNull(),
    comments: text('comments'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(tsNow),
  },
  (t) => ({
    architectureIdx: index('reviews_architecture_idx').on(t.architectureId),
  })
);

export const generatedArtifacts = sqliteTable(
  'generated_artifacts',
  {
    id: text('id').primaryKey(),
    architectureId: text('architecture_id')
      .notNull()
      .references(() => architectures.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ARTIFACT_KINDS }).notNull(),
    storagePath: text('storage_path').notNull(),
    contentHash: text('content_hash').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(tsNow),
  },
  (t) => ({
    architectureIdx: index('generated_artifacts_architecture_idx').on(
      t.architectureId
    ),
    kindHashIdx: uniqueIndex('generated_artifacts_kind_hash_idx').on(
      t.architectureId,
      t.kind,
      t.contentHash
    ),
  })
);

export { sql };
