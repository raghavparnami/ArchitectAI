import type { Architecture } from '@/lib/architecture/schema';

/**
 * Canonical Architecture → Mermaid source.
 *
 * - HLD renders as a `flowchart TB` (top-to-bottom flow).
 * - Async connections become dashed arrows ("-.->").
 * - LLD: an additional sequenceDiagram per use case (separate exports).
 *
 * Mermaid IDs are restricted to ASCII alphanumerics and underscores —
 * we sanitize stable canonical ids that already obey our kebab-case
 * convention into snake_case here.
 */

export function architectureToMermaidFlowchart(arch: Architecture): string {
  const lines: string[] = [];
  lines.push('flowchart TB');

  for (const c of arch.components) {
    lines.push(`  ${mid(c.id)}[${escapeLabel(`${c.name}\\n${c.tech ?? ''}`)}]`);
  }
  for (const ds of arch.dataStores) {
    // [(text)] is mermaid's "cylinder" shape for databases.
    lines.push(`  ${mid(ds.id)}[(${escapeLabel(ds.name)})]`);
  }
  for (const ext of arch.externalSystems) {
    // (((text))) is the "double-circle" external shape.
    lines.push(`  ${mid(ext.id)}(((${escapeLabel(ext.name)})))`);
  }

  for (const conn of arch.connections) {
    const arrow = conn.sync === 'async' ? '-.->' : '-->';
    const label = conn.dataFlow ? `|${escapeLabel(conn.dataFlow)}|` : '';
    lines.push(
      `  ${mid(conn.fromComponentId)} ${arrow}${label} ${mid(conn.toComponentId)}`
    );
  }

  return lines.join('\n');
}

export function useCaseSequenceToMermaid(
  arch: Architecture,
  useCaseId: string
): string | null {
  const seq = arch.sequences.find((s) => s.useCaseId === useCaseId);
  if (!seq) return null;

  const lines: string[] = ['sequenceDiagram'];
  for (const actor of seq.actors) {
    lines.push(`  participant ${mid(actor)}`);
  }
  for (const step of seq.steps) {
    const arrow =
      step.type === 'async' ? '-)' : step.type === 'return' ? '-->>' : '->>';
    lines.push(`  ${mid(step.from)}${arrow}${mid(step.to)}: ${escapeLabel(step.message)}`);
  }
  return lines.join('\n');
}

function mid(id: string): string {
  // Mermaid ids: alpha + numerics + underscore. kebab-case → snake_case.
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function escapeLabel(s: string): string {
  // Mermaid label gotchas: pipe, square brackets, double quotes.
  return s.replace(/"/g, "'").replace(/\|/g, '\\|').slice(0, 80);
}
