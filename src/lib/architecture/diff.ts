import type { Architecture, Component, Connection } from './schema';

export type FieldChange = {
  path: string;
  before: unknown;
  after: unknown;
};

export type EntityChange = {
  id: string;
  fields: FieldChange[];
};

export type ArchitectureDiff = {
  components: { added: Component[]; removed: Component[]; changed: EntityChange[] };
  connections: { added: Connection[]; removed: Connection[]; changed: EntityChange[] };
  decisionsAdded: string[]; // decision ids
  decisionsRemoved: string[];
  decisionsChanged: EntityChange[];
};

/**
 * Human-readable diff between two architectures, used for the
 * regenerate-review UI ("here's what changed").
 *
 * Field-level diffing is intentionally shallow — we walk the top-level
 * keys of each entity and report changes there. Going deeper than that
 * (e.g. per-API-method on a component) is left for a focused viewer.
 */
export function diffArchitectures(
  before: Architecture,
  after: Architecture
): ArchitectureDiff {
  const componentsBefore = new Map(before.components.map((c) => [c.id, c]));
  const componentsAfter = new Map(after.components.map((c) => [c.id, c]));

  const connectionsBefore = new Map(before.connections.map((c) => [c.id, c]));
  const connectionsAfter = new Map(after.connections.map((c) => [c.id, c]));

  return {
    components: {
      added: after.components.filter((c) => !componentsBefore.has(c.id)),
      removed: before.components.filter((c) => !componentsAfter.has(c.id)),
      changed: after.components
        .filter((c) => componentsBefore.has(c.id))
        .map((c) => ({
          id: c.id,
          fields: shallowFieldDiff(componentsBefore.get(c.id), c),
        }))
        .filter((e) => e.fields.length > 0),
    },
    connections: {
      added: after.connections.filter((c) => !connectionsBefore.has(c.id)),
      removed: before.connections.filter((c) => !connectionsAfter.has(c.id)),
      changed: after.connections
        .filter((c) => connectionsBefore.has(c.id))
        .map((c) => ({
          id: c.id,
          fields: shallowFieldDiff(connectionsBefore.get(c.id), c),
        }))
        .filter((e) => e.fields.length > 0),
    },
    decisionsAdded: after.decisions
      .filter((d) => !before.decisions.find((b) => b.id === d.id))
      .map((d) => d.id),
    decisionsRemoved: before.decisions
      .filter((d) => !after.decisions.find((a) => a.id === d.id))
      .map((d) => d.id),
    decisionsChanged: after.decisions
      .map((d) => {
        const prev = before.decisions.find((p) => p.id === d.id);
        if (!prev) return null;
        const fields = shallowFieldDiff(prev, d);
        return fields.length > 0 ? { id: d.id, fields } : null;
      })
      .filter((e): e is EntityChange => e !== null),
  };
}

function shallowFieldDiff(
  before: unknown,
  after: unknown
): FieldChange[] {
  if (before == null || after == null) return [];
  const out: FieldChange[] = [];
  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      out.push({ path: key, before: a[key], after: b[key] });
    }
  }
  return out;
}
