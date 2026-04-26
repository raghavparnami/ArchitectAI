/**
 * Clean up a label that came back from an LLM or was imported from a diagram
 * source. Strips wrapping quotes and converts literal `\n` strings into real
 * newlines so the renderer can show multi-line labels.
 */
export function sanitizeLabel(raw: unknown): string {
  let s = String(raw ?? '').trim();
  // Strip surrounding straight or curly quotes (one or more on each side)
  s = s.replace(/^["'""''`]+|["'""''`]+$/g, '');
  // Convert literal backslash-n into a real newline
  s = s.replace(/\\n/g, '\n');
  // Convert literal "\\n" or "/n" patterns
  s = s.replace(/\/n(?![A-Za-z])/g, '\n');
  // Collapse 3+ newlines down to 2
  s = s.replace(/\n{3,}/g, '\n\n');
  // Trim each line individually
  s = s.split('\n').map((line) => line.trim()).filter(Boolean).join('\n');
  return s.trim().slice(0, 60);
}

/**
 * Edge labels need to be short. Truncate aggressively so they don't collide
 * with nodes when rendered at the bezier midpoint.
 */
export function sanitizeEdgeLabel(raw: unknown): string {
  let s = String(raw ?? '').trim();
  s = s.replace(/^["'""''`]+|["'""''`]+$/g, '');
  s = s.replace(/\\n/g, ' ').replace(/\s+/g, ' ');
  if (s.length > 18) s = s.slice(0, 17) + '…';
  return s;
}
