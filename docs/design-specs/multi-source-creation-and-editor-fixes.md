# Design Spec — Multi-source diagram creation + Editor gap fixes

| | |
|---|---|
| **Status** | Draft — awaiting approval |
| **Author** | Claude |
| **Date** | 2026-04-07 |
| **Scope** | New "Create Diagram" experience + closing the editor gaps from the prior audit |

---

## 1. Problem

Right now creating a diagram has one path: AI wizard or blank canvas. Two big gaps:

1. **You can't bring an existing diagram in.** No image upload, no XML paste, no Mermaid paste. If you have a whiteboard photo or a draw.io export, you have to redraw it from scratch.
2. **The AI is one-shot.** The wizard generates once, then if you want to iterate you have to use the bottom AI bar — there's no real "design conversation" experience.

On top of that, the editor itself is missing core direct-manipulation features (undo, resize, snap, export, etc — see §5) that people expect from any drawing tool. These bite **every** session.

---

## 2. Goals / non-goals

### Goals
- One unified **"New Diagram" modal** with three clear entry points
- Bring-your-own-diagram via **image / draw.io XML / Mermaid / JSON** with AI parsing
- **Multi-turn AI chat** for design conversations (replace single-shot wizard)
- Close the **top 10 editor gaps** that hurt while creating
- Ship in **two phases** so each is reviewable

### Non-goals (this spec)
- Real-time multiplayer
- Real Supabase persistence (still localStorage)
- Stripe billing
- Mobile / touch
- SSO, SAML, audit logs

---

## 3. New "Create Diagram" experience

### 3.1 Replace `NewDiagramChooser` with a tabbed modal

```
┌─ New Diagram ────────────────────────────────────┐
│  [📷 Import]  [💬 Design Chat]  [📄 Blank]        │
│                                                   │
│  …tab content…                                    │
│                                                   │
│              [Cancel]   [Continue →]              │
└──────────────────────────────────────────────────┘
```

Three tabs, persistent across modal opens. Default = `Design Chat` (most common).

### 3.2 Tab 1 — Import

User drops in **any** of these and AI converts it to canvas state:

| Source | How | Backend |
|---|---|---|
| Image (PNG/JPG of whiteboard, draw.io export, screenshot) | drag-drop or file picker | Gemini 2.5 Pro **vision** input |
| draw.io XML | paste textarea | Server-side parse with `fast-xml-parser`, map cells → nodes |
| Mermaid (`graph LR`, `flowchart`, `erDiagram`) | paste textarea | Parse with the official `mermaid` package |
| Raw JSON (our own export format) | paste or file | `JSON.parse` → validate against `DiagramNode[]` |

**UI:**
- Single drop-zone that accepts files (images) and a textarea below for text formats
- Auto-detects format from MIME type / first chars
- "Detect & import" button → calls `/api/ai/import`
- After import: pop the user into the editor with the parsed diagram + a top banner: **"Imported from screenshot. [Improve with AI →]"**

**One new endpoint:** `POST /api/ai/import`
```ts
// body: { source: 'image' | 'xml' | 'mermaid' | 'json', payload: string | base64 }
// returns: { nodes, connections, suggestions, sourceDetected }
```

### 3.3 Tab 2 — Design Chat

Multi-turn conversation that BUILDS the diagram incrementally.

```
┌─ Design Chat ──────────────────────────────────┐
│  [System: Describe what you want to build.]    │
│  [You: A SaaS for tracking gym workouts…]      │
│  [AI: ✓ Created 7 nodes. Anything else?]       │
│  [You: Add Stripe for billing]                 │
│  [AI: ✓ Added Stripe + webhook handler.]       │
│                                                 │
│  [_______________________] [Send]              │
│  Live preview (right) updates as you go        │
└────────────────────────────────────────────────┘
```

- Two-pane: chat on left, **live diagram preview on right** (mini Canvas, read-only)
- Each user turn calls `/api/ai/chat` which is the existing `/api/ai/refine` with a message-history flag
- System keeps the running diagram state in component state until the user clicks **"Open in editor"**
- Conversation history is saved on the diagram (`messages: ChatMessage[]`)

**One new endpoint extension:** `POST /api/ai/chat`
```ts
// body: { messages: [{role, content}], currentNodes, currentConnections }
// returns: { reply, nodes, connections, suggestions }
```

### 3.4 Tab 3 — Blank

Identical to today's "Start blank" — creates an empty `Diagram` and navigates. No AI calls.

---

## 4. Evaluate-and-improve loop

After ANY creation path (import / chat / blank), the editor surfaces a single CTA pill in the header:

```
┌─────────────────────────────────────────┐
│ ◀ Untitled · DRAFT  [✨ Evaluate & Improve] │
└─────────────────────────────────────────┘
```

Clicking it:
1. Calls `/api/ai/evaluate` (already exists)
2. Shows the EvaluationPanel (already exists)
3. Adds a new button **"Apply top 3 fixes"** which calls a new endpoint:

**`POST /api/ai/improve`**
```ts
// body: { nodes, connections, recommendations: string[] }
// returns: { nodes, connections, changeSummary }
```

This is essentially batched `/api/ai/refine` calls with the recommendations as instructions. Updates canvas in place.

---

## 5. Editor gap fixes (Phase B — same approval)

The 10 issues that bite every session, in the order I'd implement:

| # | Gap | Implementation hint | Effort |
|---|---|---|---|
| 1 | **Undo / redo** (Cmd+Z / Cmd+Shift+Z) | `zundo` middleware on canvas store; `pause()/resume()` around drag | S |
| 2 | **Resize handles** on selected nodes | 8 handles (corners + midpoints) on `CanvasNode`; track in `Canvas.tsx` | M |
| 3 | **Snap to grid** (20px, hold Shift to bypass) | round x/y in `moveNode`; toggle in `liveRef` | S |
| 4 | **Keyboard nudge** (arrows = 1px, Shift+arrows = 10px) | extend keyboard handler in `Canvas.tsx` | XS |
| 5 | **Fit to screen** | compute bbox, set zoom + pan; toolbar button | S |
| 6 | **Export PNG / SVG** | `html-to-image` package; toolbar dropdown | S |
| 7 | **Right-click context menu** | new `<ContextMenu>` portal; show on `onContextMenu` | M |
| 8 | **Mini-map** | new `<MiniMap>` SVG in bottom-right; click to pan | M |
| 9 | **Cmd+K search palette** | new `<SearchPalette>` modal listing nodes by label | S |
| 10 | **Lock node** | `locked: boolean` on `DiagramNode`; skip drag/resize/delete when locked | S |

**Deferred to next spec** (still in the gap audit but not this batch):
- Smart alignment guides
- Inline edit connection labels
- Manual connection routing / waypoints
- Group/ungroup nodes inside containers
- Connection style picker (solid/dashed/dotted UI)
- Layer order (bring-to-front / send-to-back)

---

## 6. Data model changes

### `DiagramNode` — additive only

```ts
export interface DiagramNode {
  // …existing
  locked?: boolean;        // NEW — block drag/resize/delete
  z?: number;              // NEW — layer order, default 0
}
```

### `StoredDiagram` — additive only

```ts
export interface StoredDiagram extends Diagram {
  // …existing
  messages?: ChatMessage[];  // NEW — conversation history from Tab 2
  importSource?: 'image' | 'xml' | 'mermaid' | 'json' | null;  // NEW — provenance
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
```

No migration needed — fields are optional, localStorage entries without them keep working.

---

## 7. New files

```
src/components/diagram/
  CreateDiagramModal.tsx          # NEW — three-tab modal (replaces NewDiagramChooser)
  tabs/
    ImportTab.tsx                 # NEW — drop zone + textarea, format detection
    ChatTab.tsx                   # NEW — chat history + live preview
    BlankTab.tsx                  # NEW — minimal "create empty" form

src/components/canvas/
  ResizeHandles.tsx               # NEW — 8 handles overlay on selected node
  ContextMenu.tsx                 # NEW — right-click menu portal
  MiniMap.tsx                     # NEW — overview navigator
  SearchPalette.tsx               # NEW — Cmd+K node search

src/lib/import/
  parseMermaid.ts                 # NEW — wrap mermaid → nodes/connections
  parseDrawioXml.ts               # NEW — wrap fast-xml-parser → nodes/connections

src/app/api/ai/
  import/route.ts                 # NEW — POST: source + payload → diagram
  chat/route.ts                   # NEW — POST: messages + state → reply + diagram
  improve/route.ts                # NEW — POST: nodes + recs → updated diagram
```

### Files modified

```
src/lib/types.ts                  # add locked, z, messages, importSource, ChatMessage
src/stores/canvas.store.ts        # wrap with zundo temporal middleware
src/components/canvas/Canvas.tsx  # resize, snap, nudge, context menu, fit, search
src/components/canvas/Toolbar.tsx # undo/redo + fit + export buttons
src/components/canvas/CanvasNode.tsx # render resize handles + lock indicator
src/app/(app)/dashboard/page.tsx  # use CreateDiagramModal instead of NewDiagramChooser
src/app/(app)/diagram/[id]/page.tsx # "Improve" CTA after import
package.json                      # add zundo, html-to-image, fast-xml-parser, mermaid
```

### Files deleted
```
src/components/diagram/NewDiagramChooser.tsx  # superseded
```

---

## 8. Implementation plan

Two phases. Each ships independently and is reviewable on its own.

### Phase A — Multi-source creation (3 tabs + import)
1. Install deps: `fast-xml-parser`, `mermaid`
2. Add types (`ChatMessage`, `importSource`, `messages`)
3. Build `/api/ai/import` (image via Gemini Vision, XML/Mermaid via parsers)
4. Build `/api/ai/chat`
5. Build `CreateDiagramModal` + 3 tab components
6. Wire from dashboard
7. Add "Improve" CTA in editor header
8. Build `/api/ai/improve`

### Phase B — Editor gaps (10 fixes)
1. Install `zundo`, `html-to-image`
2. Wrap canvas store with `temporal`
3. Add `locked`, `z` to types
4. Toolbar: undo, redo, fit, export
5. `Canvas.tsx`: keyboard nudge, snap-to-grid, resize handle math
6. `CanvasNode.tsx`: render resize handles
7. `ContextMenu.tsx` + wire to right-click
8. `MiniMap.tsx`
9. `SearchPalette.tsx` + Cmd+K binding
10. Lock toggle in PropertiesPanel + ContextMenu

---

## 9. Out of scope (will need a separate spec)

- Real Supabase persistence + multi-device sync
- Real-time multiplayer with cursors
- Stripe billing wired end-to-end
- Email notifications via Resend
- SSO / SAML / RBAC enforcement
- Audit logs UI
- Touch / mobile canvas
- Light / dark theme
- Smart alignment guides
- Connection waypoint editing
- SQL DDL export from ER entities
- Repo-import-to-architecture
- Slack / Linear / GitHub integrations

---

## 10. Open questions

1. **Import limits.** Should free-tier image imports be capped (e.g. 3/month)? My default: yes, share the AI generation quota.
2. **Chat preview interactivity.** The right-pane preview in Tab 2 — read-only or editable? My default: read-only this version, editable next pass.
3. **Failed image parses.** When Gemini Vision can't extract nodes, do we drop the user into a blank canvas or block? My default: drop into blank with the original image as a freehand background layer (uses `FreehandStroke` slot).
4. **draw.io XML edge cases.** Lots of dialects (mxGraph, drawio cloud, …). My default: support the most common mxCell shape with `value`, `style`, `geometry`, `source`, `target`. Document unsupported.
5. **Mermaid scope.** `flowchart`, `erDiagram`, `sequenceDiagram`? My default: just `flowchart` and `erDiagram` for now.
6. **Improve CTA placement.** Header pill, or auto-popover after import? My default: header pill, dismissible.

---

## 11. Approval

Reply with:

- ✅ **Approve as-is** — I start Phase A immediately
- ✅ **Approve with changes** — leave inline notes / send a list
- ❌ **Reject** — what to rethink

Or pick a smaller cut: "just Phase A" / "just Phase B" / "just the import tab".
