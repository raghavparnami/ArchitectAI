import type { Architecture } from './schema';

export type Invariant = {
  code: string;
  message: string;
  // Path into the canonical object where the violation lives, useful for
  // surfacing inline errors in the editor.
  path?: (string | number)[];
};

/**
 * Run all invariants against a canonical architecture. Returns an empty
 * array on success. We collect all violations rather than fail-fast so the
 * UI can render every issue at once.
 */
export function checkInvariants(arch: Architecture): Invariant[] {
  const v: Invariant[] = [];
  const componentIds = new Set(arch.components.map((c) => c.id));
  const dataStoreIds = new Set(arch.dataStores.map((d) => d.id));
  const externalIds = new Set(arch.externalSystems.map((e) => e.id));
  const decisionIds = new Set(arch.decisions.map((d) => d.id));
  const citationIds = new Set(arch.citations.map((c) => c.id));
  const nfrIds = new Set(arch.nfrs.map((n) => n.id));
  const useCaseIds = new Set(arch.useCases.map((u) => u.id));

  // ─── Unique IDs within each collection ───────────────────────────────────
  for (const collection of [
    { name: 'components', items: arch.components },
    { name: 'connections', items: arch.connections },
    { name: 'dataStores', items: arch.dataStores },
    { name: 'externalSystems', items: arch.externalSystems },
    { name: 'decisions', items: arch.decisions },
    { name: 'citations', items: arch.citations },
    { name: 'useCases', items: arch.useCases },
    { name: 'sequences', items: arch.sequences },
    { name: 'nfrs', items: arch.nfrs },
  ]) {
    const seen = new Set<string>();
    for (const [idx, item] of collection.items.entries()) {
      if (seen.has(item.id)) {
        v.push({
          code: 'DUPLICATE_ID',
          message: `Duplicate id "${item.id}" in ${collection.name}`,
          path: [collection.name, idx],
        });
      }
      seen.add(item.id);
    }
  }

  // ─── Connections reference real endpoints ───────────────────────────────
  arch.connections.forEach((conn, idx) => {
    const valid = (id: string) =>
      componentIds.has(id) || dataStoreIds.has(id) || externalIds.has(id);

    if (!valid(conn.fromComponentId)) {
      v.push({
        code: 'CONNECTION_FROM_MISSING',
        message: `Connection ${conn.id} references unknown source ${conn.fromComponentId}`,
        path: ['connections', idx, 'fromComponentId'],
      });
    }
    if (!valid(conn.toComponentId)) {
      v.push({
        code: 'CONNECTION_TO_MISSING',
        message: `Connection ${conn.id} references unknown target ${conn.toComponentId}`,
        path: ['connections', idx, 'toComponentId'],
      });
    }
    if (conn.fromComponentId === conn.toComponentId) {
      v.push({
        code: 'CONNECTION_SELF_LOOP',
        message: `Connection ${conn.id} loops on itself`,
        path: ['connections', idx],
      });
    }
  });

  // ─── Component nfrIds reference real NFRs ───────────────────────────────
  arch.components.forEach((c, idx) => {
    c.nfrIds.forEach((nfrId, ni) => {
      if (!nfrIds.has(nfrId)) {
        v.push({
          code: 'NFR_MISSING',
          message: `Component ${c.id} references missing NFR ${nfrId}`,
          path: ['components', idx, 'nfrIds', ni],
        });
      }
    });
  });

  // ─── Decisions: chosen must match one of options ────────────────────────
  arch.decisions.forEach((d, idx) => {
    if (!d.options.some((o) => o.name === d.chosen)) {
      v.push({
        code: 'DECISION_CHOSEN_INVALID',
        message: `Decision ${d.id}: chosen "${d.chosen}" is not in options`,
        path: ['decisions', idx, 'chosen'],
      });
    }
    d.sourceCitationIds.forEach((cid, ci) => {
      if (!citationIds.has(cid)) {
        v.push({
          code: 'CITATION_MISSING',
          message: `Decision ${d.id} cites unknown citation ${cid}`,
          path: ['decisions', idx, 'sourceCitationIds', ci],
        });
      }
    });
  });

  // ─── Use case sequenceId points at a real sequence ─────────────────────
  const sequenceIds = new Set(arch.sequences.map((s) => s.id));
  arch.useCases.forEach((u, idx) => {
    if (u.sequenceId && !sequenceIds.has(u.sequenceId)) {
      v.push({
        code: 'SEQUENCE_MISSING',
        message: `Use case ${u.id} references missing sequence ${u.sequenceId}`,
        path: ['useCases', idx, 'sequenceId'],
      });
    }
  });

  // ─── Sequences reference a real use case ───────────────────────────────
  arch.sequences.forEach((s, idx) => {
    if (!useCaseIds.has(s.useCaseId)) {
      v.push({
        code: 'SEQUENCE_USECASE_MISSING',
        message: `Sequence ${s.id} references missing use case ${s.useCaseId}`,
        path: ['sequences', idx, 'useCaseId'],
      });
    }
  });

  // ─── LLD-specific: every component MUST reference an HLD parent ─────────
  if (arch.level === 'LLD') {
    arch.components.forEach((c, idx) => {
      // External components are exempt — they're allowed to appear in LLD
      // even if the HLD didn't model them yet.
      if (c.type !== 'external' && !c.hldComponentId) {
        v.push({
          code: 'LLD_COMPONENT_NO_HLD_PARENT',
          message: `LLD component ${c.id} has no hldComponentId — drill-down trace is broken`,
          path: ['components', idx, 'hldComponentId'],
        });
      }
    });
  }

  // ─── Manual edits target real entities ─────────────────────────────────
  arch.manualEdits.forEach((e, idx) => {
    let pool: Set<string>;
    switch (e.targetType) {
      case 'component':
        pool = componentIds;
        break;
      case 'connection':
        pool = new Set(arch.connections.map((c) => c.id));
        break;
      case 'datastore':
        pool = dataStoreIds;
        break;
      case 'decision':
        pool = decisionIds;
        break;
      case 'nfr':
        pool = nfrIds;
        break;
      case 'externalSystem':
        pool = externalIds;
        break;
      case 'useCase':
        pool = useCaseIds;
        break;
    }
    if (!pool.has(e.targetId)) {
      v.push({
        code: 'EDIT_TARGET_MISSING',
        message: `Manual edit ${e.id} targets ${e.targetType} ${e.targetId} which no longer exists`,
        path: ['manualEdits', idx, 'targetId'],
      });
    }
  });

  return v;
}

/** Throws on any violation. Convenience for code paths that can't recover. */
export function assertInvariants(arch: Architecture): void {
  const violations = checkInvariants(arch);
  if (violations.length > 0) {
    const summary = violations
      .slice(0, 5)
      .map((v) => `[${v.code}] ${v.message}`)
      .join('\n');
    const more =
      violations.length > 5 ? `\n…and ${violations.length - 5} more` : '';
    throw new Error(`Architecture invariants failed:\n${summary}${more}`);
  }
}
