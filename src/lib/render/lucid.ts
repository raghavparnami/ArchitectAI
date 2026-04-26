import type { Architecture } from '@/lib/architecture/schema';

/**
 * Canonical Architecture → Lucidchart Standard Import XML.
 *
 * Reference: https://lucid.app/documents/standard-import
 *
 * The standard import format is intentionally simple: a list of shapes
 * with positions + a list of connections between them. We don't try to
 * exploit Lucid's library shapes — generic rectangles + arrows give a
 * clean starting board users can re-style in Lucid.
 */

const CELL_W = 180;
const CELL_H = 80;
const HSPACE = 60;
const VSPACE = 60;

export function architectureToLucidXml(arch: Architecture): string {
  const shapes: string[] = [];
  const lines: string[] = [];

  const positionFor = (i: number): { x: number; y: number } => ({
    x: 50 + (i % 4) * (CELL_W + HSPACE),
    y: 50 + Math.floor(i / 4) * (CELL_H + VSPACE),
  });

  let i = 0;
  for (const c of arch.components) {
    const pos = c.position ?? positionFor(i++);
    shapes.push(shape(c.id, c.name, pos.x, pos.y, 'Process'));
  }
  for (const ds of arch.dataStores) {
    const pos = positionFor(i++);
    shapes.push(shape(ds.id, ds.name, pos.x, pos.y, 'Cylinder'));
  }
  for (const ext of arch.externalSystems) {
    const pos = positionFor(i++);
    shapes.push(shape(ext.id, ext.name, pos.x, pos.y, 'Terminator'));
  }

  for (const conn of arch.connections) {
    lines.push(line(conn.id, conn.fromComponentId, conn.toComponentId, conn.dataFlow));
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<lucidchart version="1">',
    '  <page name="Architecture">',
    ...shapes.map((s) => `    ${s}`),
    ...lines.map((l) => `    ${l}`),
    '  </page>',
    '</lucidchart>',
  ].join('\n');
}

function shape(
  id: string,
  text: string,
  x: number,
  y: number,
  kind: 'Process' | 'Cylinder' | 'Terminator'
): string {
  return `<shape id="${escapeXml(id)}" type="${kind}" x="${x}" y="${y}" width="${CELL_W}" height="${CELL_H}"><text>${escapeXml(text)}</text></shape>`;
}

function line(id: string, from: string, to: string, label: string): string {
  return `<line id="${escapeXml(id)}" from="${escapeXml(from)}" to="${escapeXml(to)}"><text>${escapeXml(label)}</text></line>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
