<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Architectai project guide

Key Next.js 16 differences that have already bitten this codebase:

- **`middleware.ts` was renamed to `proxy.ts`** with a `proxy` export
  (not `middleware`). Our auth gate lives at `src/proxy.ts`.
- **Route handlers' `ctx.params` is async**: `await ctx.params` not
  `ctx.params`.
- **No `runtime` config option in `proxy.ts`** (it always runs Node.js
  runtime in 16).

## High-level shape

```
src/
  app/                                 # routes
    (app)/dashboard, /diagram, /settings   ← protected
    (auth)/sign-in, /sign-up               ← Clerk pages
    api/
      ai/{generate,chat,evaluate,improve,refine,import}/route.ts  ← LEGACY (Gemini-hardcoded; M2 will replace)
      trpc/[trpc]/route.ts             ← typed mutations
      inngest/route.ts                 ← background-job webhook
      webhooks/                        ← (Clerk, Stripe; public)
    layout.tsx                         ← ClerkProvider + TRPCProvider
    page.tsx                           ← marketing landing
  components/                          ← canvas + diagram + ui (existing)
  lib/
    architecture/
      schema.ts          Zod-validated canonical Architecture
      invariants.ts      structural validation (FK refs, LLD parents…)
      merge.ts           3-way merge for regen-with-edits
      diff.ts            human-readable diff for the review UI
    llm/
      providers.ts       Vercel AI SDK provider factory
      keys.ts            libsodium envelope encryption for BYO keys
      client.ts          resolveModel(): BYO → server default → throw
      prompts/hld.ts     HLD prompt + zod output schema
    research/
      tavily.ts          web research → Citation rows
      embeddings.ts      OpenAI text-embedding-3-small for pgvector
    render/
      canvas.ts          canonical → existing DiagramNode canvas
      mermaid.ts         canonical → flowchart / sequence
      excalidraw.ts      canonical → Excalidraw scene JSON
      lucid.ts           canonical → Lucid Standard Import XML
    db/
      schema.ts          Drizzle ORM schema
      index.ts           server-only `db` client (postgres-js)
      migrations/        SQL migrations (0000_extensions.sql is hand-written)
    inngest/
      client.ts          typed Inngest event registry
      functions/         generateHld, regenerateWithEdits
    trpc/                React provider + typed client
    types.ts             ⚠️ legacy canvas types (DiagramNode, etc.); kept
                         while we migrate routes to the canonical model
    layout.ts            existing canvas auto-layout
    tech-catalog.ts      tech logos for the canvas
    canvas-utils.ts, labels.ts, import/parseMermaid|parseDrawioXml.ts
  server/
    context.ts           tRPC context (Clerk auth + lazy user-row insert)
    trpc.ts              router + protectedProcedure
    routers/
      _app.ts            root router
      projects.ts
      architectures.ts   create / list / setState / generateHld / regenerate
      llm-keys.ts        BYO key management (encrypted at rest)
  stores/                ⚠️ legacy localStorage stores; M0 keeps them
                         around so the existing canvas keeps working
                         while we migrate to DB-backed state
  proxy.ts               Clerk auth gate (Next.js 16 'proxy' convention)
```

## Canonical model is the source of truth

Anything user-visible — diagram, ERD, Mermaid, doc generation, Jira
export, code scaffolds — derives from `Architecture` (see
`lib/architecture/schema.ts`). The renderers in `lib/render/` are
projections; the canvas store types in `lib/types.ts` are a
projection target, NOT the model.

When you need to mutate state, mutate the canonical and re-render. The
canvas-side store gets repopulated by `architectureToCanvas()`.

## Stable IDs are the regeneration contract

Every component / connection / decision has a stable `id` (lowercase
kebab-case). The merge algorithm matches by id; the LLM is instructed
to reuse ids from the prior architecture. Renaming a component is a
label change, not a new id — preserves pinned edits.

## BYO API key handling — non-negotiable invariants

- Plaintext keys are decrypted **in-memory only** at the LLM call site
  (`lib/llm/client.ts`).
- Plaintext keys MUST NOT appear in logs, errors, or HTTP responses.
- `previewKey()` is the only sanctioned redaction helper.
- Re-encryption on key rotation goes through `reencrypt()` — see
  `lib/llm/keys.ts`.

## What to leave alone (for now)

- `src/app/api/ai/*` — legacy Gemini routes. Kept until M2 lands the
  provider abstraction end-to-end. Don't refactor; rewrite.
- `src/stores/diagrams.store.ts` — localStorage shim. Will be replaced
  by tRPC queries once we migrate dashboard/settings/diagram pages.

## How to add a new architecture feature (e.g. ERDs, sequences)

1. Add the type to `lib/architecture/schema.ts` (zod first, type
   inferred).
2. Add invariants in `lib/architecture/invariants.ts`.
3. Update merge handling if the new collection has stable ids.
4. Add a renderer projection in `lib/render/<format>.ts`.
5. Wire a tRPC mutation if the user needs to edit it directly.
6. Surface in the UI.

## Database migrations

```bash
npm run db:generate   # after editing src/lib/db/schema.ts
npm run db:migrate    # apply to DB at $DATABASE_URL
npm run db:studio     # browse the DB
```

`src/lib/db/migrations/0000_extensions.sql` is hand-written and must
run before drizzle-generated migrations — it enables `vector` and
`pgcrypto` extensions that drizzle-kit doesn't know to emit.
