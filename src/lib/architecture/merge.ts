import type {
  Architecture,
  Component,
  Connection,
  DataStore,
  Decision,
  ExternalSystem,
  ManualEdit,
  Nfr,
  UseCase,
} from './schema';

// ─── Diff types ─────────────────────────────────────────────────────────────

export type CollectionKey =
  | 'components'
  | 'connections'
  | 'dataStores'
  | 'externalSystems'
  | 'decisions'
  | 'nfrs'
  | 'useCases';

export type CollectionDiff = {
  added: string[]; // ids only in `next`
  removed: string[]; // ids only in `base` (kept in merged with `orphan` flag)
  changed: string[]; // ids in both, with at least one differing field
  preserved: string[]; // ids in both that survived because of a pinned edit
};

export type MergeDiff = Record<CollectionKey, CollectionDiff>;

export type MergeResult = {
  merged: Architecture;
  diff: MergeDiff;
  /**
   * Ids of entities present in `base` but missing from `next`. Kept in
   * `merged` so the user can review before deletion. The UI should
   * display these with an "orphan in regeneration" affordance.
   */
  orphanIds: { collection: CollectionKey; id: string }[];
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Three-way merge of a freshly-generated architecture with the prior
 * canonical state, respecting pinned manual edits.
 *
 * Rules (priority order, per field):
 *   1. A pinned ManualEdit on a field always wins.
 *   2. If an entity exists in both base and next (matched by stable id),
 *      take the next version's fields, then re-apply pinned edits.
 *   3. If an entity exists in base but not next, preserve it (orphan).
 *   4. If an entity is new in next, add it.
 *   5. Pinned edits whose target was deleted are dropped from the merged
 *      manualEdits — the UI shows them in `diff.removed` so the user can
 *      decide whether to recreate them.
 *
 * The function does NOT validate invariants — call `assertInvariants(merged)`
 * after. We separate concerns so callers can tolerate partial merges
 * during interactive editing.
 */
export function mergeArchitectures(
  base: Architecture,
  next: Architecture
): MergeResult {
  // Pinned edits are the ones we have to honor across regeneration.
  const pinned = base.manualEdits.filter((e) => e.pinned);

  const orphanIds: MergeResult['orphanIds'] = [];
  const diff: MergeDiff = {
    components: emptyDiff(),
    connections: emptyDiff(),
    dataStores: emptyDiff(),
    externalSystems: emptyDiff(),
    decisions: emptyDiff(),
    nfrs: emptyDiff(),
    useCases: emptyDiff(),
  };

  const components = mergeCollection<Component>(
    base.components,
    next.components,
    pinned,
    'component',
    diff.components,
    orphanIds,
    'components'
  );

  const connections = mergeCollection<Connection>(
    base.connections,
    next.connections,
    pinned,
    'connection',
    diff.connections,
    orphanIds,
    'connections'
  );

  const dataStores = mergeCollection<DataStore>(
    base.dataStores,
    next.dataStores,
    pinned,
    'datastore',
    diff.dataStores,
    orphanIds,
    'dataStores'
  );

  const externalSystems = mergeCollection<ExternalSystem>(
    base.externalSystems,
    next.externalSystems,
    pinned,
    'externalSystem',
    diff.externalSystems,
    orphanIds,
    'externalSystems'
  );

  const decisions = mergeCollection<Decision>(
    base.decisions,
    next.decisions,
    pinned,
    'decision',
    diff.decisions,
    orphanIds,
    'decisions'
  );

  const nfrs = mergeCollection<Nfr>(
    base.nfrs,
    next.nfrs,
    pinned,
    'nfr',
    diff.nfrs,
    orphanIds,
    'nfrs'
  );

  const useCases = mergeCollection<UseCase>(
    base.useCases,
    next.useCases,
    pinned,
    'useCase',
    diff.useCases,
    orphanIds,
    'useCases'
  );

  // Citations: union by id; new citations from `next` are added, base
  // citations are preserved (they may still be referenced by surviving
  // decisions).
  const citationsById = new Map(base.citations.map((c) => [c.id, c]));
  for (const c of next.citations) citationsById.set(c.id, c);
  const citations = Array.from(citationsById.values());

  // Sequences ride along with their use case; merge by id.
  const sequencesById = new Map(base.sequences.map((s) => [s.id, s]));
  for (const s of next.sequences) sequencesById.set(s.id, s);
  const sequences = Array.from(sequencesById.values());

  // Manual edits whose target survived are carried forward; the rest are
  // dropped.
  const survivingTargets = collectAllIds({
    components,
    connections,
    dataStores,
    externalSystems,
    decisions,
    nfrs,
    useCases,
  });
  const manualEdits = base.manualEdits.filter((e) =>
    survivingTargets[mapTargetTypeToCollection(e.targetType)].has(e.targetId)
  );

  const merged: Architecture = {
    ...next,
    // Inherit identity + lifecycle from base; bump version externally.
    id: next.id,
    projectId: base.projectId,
    parentArchitectureId: base.parentArchitectureId,
    components,
    connections,
    dataStores,
    externalSystems,
    decisions,
    nfrs,
    useCases,
    sequences,
    citations,
    manualEdits,
  };

  return { merged, diff, orphanIds };
}

// ─── Internals ──────────────────────────────────────────────────────────────

type Identifiable = { id: string };

function emptyDiff(): CollectionDiff {
  return { added: [], removed: [], changed: [], preserved: [] };
}

function mergeCollection<T extends Identifiable>(
  baseItems: T[],
  nextItems: T[],
  pinnedEdits: ManualEdit[],
  editTargetType: ManualEdit['targetType'],
  diff: CollectionDiff,
  orphanIds: MergeResult['orphanIds'],
  collectionKey: CollectionKey
): T[] {
  const baseById = new Map(baseItems.map((i) => [i.id, i]));
  const nextById = new Map(nextItems.map((i) => [i.id, i]));
  const merged: T[] = [];
  const editsForType = pinnedEdits.filter((e) => e.targetType === editTargetType);

  // Items in next: keep new content, then re-apply pinned edits over it.
  for (const item of nextItems) {
    const baseItem = baseById.get(item.id);
    const itemEdits = editsForType.filter((e) => e.targetId === item.id);
    let resolved: T = item;

    if (itemEdits.length > 0) {
      resolved = applyPinnedEdits(item, itemEdits);
      diff.preserved.push(item.id);
    }

    if (!baseItem) {
      diff.added.push(item.id);
    } else if (!shallowEqual(baseItem, resolved)) {
      diff.changed.push(item.id);
    }

    merged.push(resolved);
  }

  // Items in base but not in next: preserve as orphans.
  for (const item of baseItems) {
    if (!nextById.has(item.id)) {
      diff.removed.push(item.id);
      orphanIds.push({ collection: collectionKey, id: item.id });
      merged.push(item);
    }
  }

  return merged;
}

function applyPinnedEdits<T>(item: T, edits: ManualEdit[]): T {
  let result: T = structuredClone(item);
  for (const edit of edits) {
    result = setByPath(result, edit.field, edit.value);
  }
  return result;
}

/**
 * Set a value at a dot/bracket path: 'tech', 'position.x',
 * 'responsibilities[2]', 'apis[0].path'. Mutates a clone, returns it.
 */
function setByPath<T>(obj: T, path: string, value: unknown): T {
  const segments = parsePath(path);
  if (segments.length === 0) return obj;

  // We assume the caller passed a clone; mutate in place from here.
  let cursor: unknown = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const next = (cursor as Record<string | number, unknown>)[seg];
    if (next == null) {
      // Auto-vivify objects/arrays as needed for the next segment.
      const nextSeg = segments[i + 1];
      const created = typeof nextSeg === 'number' ? [] : {};
      (cursor as Record<string | number, unknown>)[seg] = created;
      cursor = created;
    } else {
      cursor = next;
    }
  }
  (cursor as Record<string | number, unknown>)[segments[segments.length - 1]] = value;
  return obj;
}

function parsePath(path: string): (string | number)[] {
  // Splits 'apis[0].path' into ['apis', 0, 'path']
  const out: (string | number)[] = [];
  const re = /([^.[\]]+)|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    if (m[1] !== undefined) out.push(m[1]);
    else if (m[2] !== undefined) out.push(Number(m[2]));
  }
  return out;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  // Stable enough for our diff: structural string equality of JSON. Slow
  // but the inputs are small (architecture-sized).
  return JSON.stringify(a) === JSON.stringify(b);
}

function collectAllIds(args: {
  components: Component[];
  connections: Connection[];
  dataStores: DataStore[];
  externalSystems: ExternalSystem[];
  decisions: Decision[];
  nfrs: Nfr[];
  useCases: UseCase[];
}): Record<ManualEdit['targetType'], Set<string>> {
  return {
    component: new Set(args.components.map((c) => c.id)),
    connection: new Set(args.connections.map((c) => c.id)),
    datastore: new Set(args.dataStores.map((d) => d.id)),
    externalSystem: new Set(args.externalSystems.map((e) => e.id)),
    decision: new Set(args.decisions.map((d) => d.id)),
    nfr: new Set(args.nfrs.map((n) => n.id)),
    useCase: new Set(args.useCases.map((u) => u.id)),
  };
}

function mapTargetTypeToCollection(t: ManualEdit['targetType']): ManualEdit['targetType'] {
  // Identity for now; declared so the signature documents the relationship
  // and so future renames (e.g. 'datastore' → 'dataStore') stay localized.
  return t;
}
