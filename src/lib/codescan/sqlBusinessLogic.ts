import 'server-only';
import { Parser, type AST } from 'node-sql-parser';

// Business-logic-in-SQL detector. Parses SQL with node-sql-parser, walks
// the AST, and accumulates a weighted score across signals that indicate
// the query is doing work that belongs in the application/DE layer rather
// than the data-store. Falls back to regex-only signals when parse fails
// (dialect quirks, stored-proc bodies, dynamic SQL fragments).

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type SignalKey =
  | 'caseDepth'
  | 'subqueryNesting'
  | 'windowDerivation'
  | 'monetaryArithmetic'
  | 'stringParsing'
  | 'joinFanOut'
  | 'storedProcConstructs'
  | 'crossSchema'
  | 'longBody'
  | 'crossLayerDup';

export type Signal = {
  key: SignalKey;
  label: string;
  count: number;
  raw: number;
  capped: number;
};

export type DetectorResult = {
  score: number;
  severity: Severity;
  parseOk: boolean;
  parseError?: string;
  dialect: string;
  signals: Signal[];
  recommendation: string;
};

const DIALECT_FALLBACK_ORDER = ['PostgresQL', 'MySQL', 'TransactSQL', 'BigQuery'];

const STRING_FN_NAMES = new Set([
  'regexp_replace',
  'regexp_matches',
  'regexp_substr',
  'substring',
  'substr',
  'split_part',
  'translate',
  'left',
  'right',
]);
const WINDOW_DERIVATION_FNS = new Set([
  'lag',
  'lead',
  'row_number',
  'rank',
  'dense_rank',
  'ntile',
  'first_value',
  'last_value',
  'nth_value',
]);
const MONETARY_HINTS = /\b(price|amount|total|cost|fee|tax|discount|revenue|charge|net|gross|balance|salary)\b/i;
const PROC_KEYWORDS =
  /\b(IF\s+|ELSIF|ELSEIF|CASE\b|WHILE\b|LOOP\b|FOR\s+|EXCEPTION\b|DECLARE\b|BEGIN\b|RAISE\b|RETURN\b)/gi;

export function detectBusinessLogicInSql(
  sql: string,
  opts: { dialect?: string } = {}
): DetectorResult {
  const dialect = opts.dialect ?? 'PostgresQL';
  const parser = new Parser();

  let ast: AST | AST[] | null = null;
  let parseError: string | undefined;
  let parseOk = true;

  const dialectsToTry = [
    dialect,
    ...DIALECT_FALLBACK_ORDER.filter((d) => d !== dialect),
  ];
  for (const d of dialectsToTry) {
    try {
      ast = parser.astify(sql, { database: d });
      break;
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
      ast = null;
    }
  }

  if (ast === null) {
    parseOk = false;
  }

  const counters: Record<SignalKey, number> = {
    caseDepth: 0,
    subqueryNesting: 0,
    windowDerivation: 0,
    monetaryArithmetic: 0,
    stringParsing: 0,
    joinFanOut: 0,
    storedProcConstructs: 0,
    crossSchema: 0,
    longBody: 0,
    crossLayerDup: 0,
  };

  // ─── AST-based signals ─────────────────────────────────────────────────
  if (ast !== null) {
    const nodes = Array.isArray(ast) ? ast : [ast];
    for (const node of nodes) {
      walkAst(node, counters, { subqueryDepth: 0 });
    }
  }

  // ─── Regex-based signals (always run; cheap, catch what AST misses) ────
  // Stored-proc constructs: count keywords. AST parser won't accept most
  // procedural bodies, so this is the primary signal there.
  if (!parseOk) {
    const procMatches = sql.match(PROC_KEYWORDS);
    if (procMatches) counters.storedProcConstructs += procMatches.length;
  }

  // CASE-when chain depth: count WHEN tokens at top level when AST missed.
  if (!parseOk) {
    const whenMatches = sql.match(/\bWHEN\b/gi);
    if (whenMatches) {
      // Subtract 2 "free" branches (case ... when ... else baseline).
      counters.caseDepth += Math.max(0, whenMatches.length - 2);
    }
  }

  // String parsing functions (regex-detected; cheap).
  for (const fn of STRING_FN_NAMES) {
    const re = new RegExp(`\\b${fn}\\s*\\(`, 'gi');
    const matches = sql.match(re);
    if (matches) counters.stringParsing += matches.length;
  }

  // Cross-schema / cross-DB references: schema-qualified names with two dots
  // (db.schema.table) or many distinct schema prefixes.
  const crossDbMatches = sql.match(/\b\w+\.\w+\.\w+\b/g);
  if (crossDbMatches) counters.crossSchema += crossDbMatches.length;

  // Long body.
  const trimmed = sql.trim();
  const lines = trimmed.split(/\r?\n/).length;
  if (lines > 200) counters.longBody = 1;

  // Monetary arithmetic on plausible columns (regex; AST also feeds this).
  const monetaryArith = sql.match(
    new RegExp(
      `${MONETARY_HINTS.source}[\\s\\)]*[+\\-*/]|[+\\-*/]\\s*${MONETARY_HINTS.source}`,
      'gi'
    )
  );
  if (monetaryArith) counters.monetaryArithmetic += monetaryArith.length;

  // ─── Apply weights + caps ─────────────────────────────────────────────
  const weights: Record<SignalKey, { weight: number; cap: number; label: string }> = {
    caseDepth: { weight: 1, cap: 10, label: 'CASE branches beyond 2' },
    subqueryNesting: { weight: 2, cap: 8, label: 'Subquery nesting depth >2' },
    windowDerivation: { weight: 3, cap: 12, label: 'Window fn used in derivation' },
    monetaryArithmetic: { weight: 2, cap: 10, label: 'Arithmetic on monetary cols' },
    stringParsing: { weight: 2, cap: 8, label: 'String-parsing functions' },
    joinFanOut: { weight: 1, cap: 6, label: 'JOINs beyond 6' },
    storedProcConstructs: { weight: 2, cap: 15, label: 'Stored-proc control flow' },
    crossSchema: { weight: 3, cap: 9, label: 'Cross-schema references' },
    longBody: { weight: 5, cap: 5, label: 'Body >200 lines' },
    crossLayerDup: { weight: 10, cap: 10, label: 'Mirrors application logic' },
  };

  const signals: Signal[] = (Object.keys(weights) as SignalKey[]).map((key) => {
    const w = weights[key];
    const raw = counters[key] * w.weight;
    const capped = Math.min(raw, w.cap);
    return { key, label: w.label, count: counters[key], raw, capped };
  });

  const score = signals.reduce((s, sig) => s + sig.capped, 0);
  const severity = scoreToSeverity(score);
  const recommendation = recommendationFor(severity, signals);

  return {
    score,
    severity,
    parseOk,
    parseError: parseOk ? undefined : parseError,
    dialect,
    signals: signals.filter((s) => s.count > 0),
    recommendation,
  };
}

function scoreToSeverity(score: number): Severity {
  if (score >= 70) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  if (score >= 10) return 'low';
  return 'info';
}

function recommendationFor(severity: Severity, signals: Signal[]): string {
  const top = [...signals].sort((a, b) => b.capped - a.capped).slice(0, 3);
  const topLabels = top.map((s) => s.label).join(', ');
  switch (severity) {
    case 'critical':
      return `Critical: this query embeds substantial business logic (${topLabels}). Lift the computation into the service or DE layer (Spark/Airflow); leave SQL as a thin SELECT over already-shaped data.`;
    case 'high':
      return `High: extract logic to a dbt model or DE pipeline (${topLabels}). Keep this query simple — it should fetch facts, not derive them.`;
    case 'medium':
      return `Medium: candidate for migration to a dbt model. Drivers: ${topLabels}.`;
    case 'low':
      return `Low: review when convenient. Drivers: ${topLabels || 'minor signals only'}.`;
    default:
      return 'No business-logic concerns detected.';
  }
}

// ─── AST walker ───────────────────────────────────────────────────────────

type WalkCtx = { subqueryDepth: number };

function walkAst(
  node: unknown,
  counters: Record<SignalKey, number>,
  ctx: WalkCtx
) {
  if (node === null || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;

  // CASE expression: count branches beyond 2.
  if (obj.type === 'case' && Array.isArray(obj.args)) {
    const whenBranches = (obj.args as Array<{ type?: string }>).filter(
      (a) => a && a.type === 'when'
    );
    counters.caseDepth += Math.max(0, whenBranches.length - 2);
  }

  // Function calls — string parsing + window derivation.
  if (obj.type === 'aggr_func' || obj.type === 'function') {
    const name =
      typeof obj.name === 'string'
        ? obj.name.toLowerCase()
        : (obj.name as { name?: Array<{ value?: string }> })?.name?.[0]?.value
            ?.toLowerCase?.() ?? '';
    if (STRING_FN_NAMES.has(name)) counters.stringParsing += 1;
    if (WINDOW_DERIVATION_FNS.has(name) && obj.over !== undefined) {
      counters.windowDerivation += 1;
    }
  }

  // SELECT body — JOIN fan-out + recursion.
  if (obj.type === 'select') {
    const from = obj.from as Array<{ join?: string }> | undefined;
    if (Array.isArray(from)) {
      const joinCount = from.filter((f) => f && f.join).length;
      if (joinCount > 6) counters.joinFanOut += joinCount - 6;
    }

    // Bump subquery depth as we traverse columns/expressions.
    const childCtx: WalkCtx = { subqueryDepth: ctx.subqueryDepth + 1 };
    if (childCtx.subqueryDepth > 2) {
      counters.subqueryNesting += 1;
    }
    for (const k of Object.keys(obj)) {
      walkAst(obj[k], counters, childCtx);
    }
    return;
  }

  // Binary expressions on monetary-named columns.
  if (
    obj.type === 'binary_expr' &&
    typeof obj.operator === 'string' &&
    /^[+\-*/]$/.test(obj.operator)
  ) {
    const stringified = JSON.stringify(obj);
    if (MONETARY_HINTS.test(stringified)) counters.monetaryArithmetic += 1;
  }

  // Cross-schema reference: tables with a database prefix in `db`.
  if (obj.type === 'table' || obj.table !== undefined) {
    const db = obj.db;
    if (typeof db === 'string' && db.length > 0) {
      counters.crossSchema += 1;
    }
  }

  // Recurse generically.
  if (Array.isArray(node)) {
    for (const item of node) walkAst(item, counters, ctx);
    return;
  }
  for (const k of Object.keys(obj)) {
    walkAst(obj[k], counters, ctx);
  }
}

// ─── Public helpers ──────────────────────────────────────────────────────

export function severityRank(s: Severity): number {
  return { info: 0, low: 1, medium: 2, high: 3, critical: 4 }[s];
}

/**
 * Stable hash for findings dedupe. Same SQL → same key, so re-running the
 * same paste won't double-record.
 */
export function dedupeKeyFor(label: string, sql: string): string {
  // Tiny FNV-1a so we don't pull a crypto dep here.
  let h = 0x811c9dc5;
  const s = `${label}\n${sql.trim()}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `bls_${(h >>> 0).toString(16)}`;
}
