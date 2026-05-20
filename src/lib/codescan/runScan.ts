import 'server-only';
import { db, schema } from '@/lib/db';
import {
  detectBusinessLogicInSql,
  dedupeKeyFor,
  severityRank,
  type DetectorResult,
  type Severity,
} from './sqlBusinessLogic';

export type CodeScanInput = {
  projectId: string;
  triggeredByUserId: string;
  files: { label: string; sql: string }[];
  label?: string;
};

export type CodeScanOutput = {
  scanId: string;
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  results: Array<{
    findingId: string;
    fileLabel: string;
    detector: DetectorResult;
  }>;
};

const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export async function runCodeScan(
  input: CodeScanInput
): Promise<CodeScanOutput> {
  const scanId = newId('scan');
  const startedAt = new Date();

  await db.insert(schema.scans).values({
    id: scanId,
    projectId: input.projectId,
    kind: 'codescan',
    status: 'running',
    label: input.label ?? `CodeScan ${startedAt.toISOString().slice(0, 16)}`,
    triggeredByUserId: input.triggeredByUserId,
    startedAt,
  });

  const results: CodeScanOutput['results'] = [];
  const bySeverity: Record<Severity, number> = {
    info: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  try {
    for (const file of input.files) {
      if (!file.sql.trim()) continue;
      const detector = detectBusinessLogicInSql(file.sql);
      if (severityRank(detector.severity) === 0) continue;

      const findingId = newId('find');
      const dedupeKey = dedupeKeyFor(file.label, file.sql);
      const evidenceSnippet = file.sql.slice(0, 4000);

      await db
        .insert(schema.findings)
        .values({
          id: findingId,
          projectId: input.projectId,
          scanId,
          pillar: 'codescan',
          category: 'business_logic_in_sql',
          severity: detector.severity,
          status: 'open',
          confidence: detector.parseOk ? 'high' : 'medium',
          title: titleFor(file.label, detector),
          descriptionMd: describe(detector),
          suggestedFixMd: detector.recommendation,
          evidence: [
            {
              type: 'sql',
              sql: evidenceSnippet,
              dialect: detector.dialect,
              sourceLabel: file.label,
              astSummary: {
                parseOk: detector.parseOk,
                signals: detector.signals,
              },
            },
            {
              type: 'note',
              text: `Score: ${detector.score} (severity ${detector.severity}). Parse: ${
                detector.parseOk ? 'ok' : 'fallback (regex only)'
              }.`,
            },
          ],
          links: [],
          score: detector.score,
          dedupeKey,
          firstSeenScanId: scanId,
          lastSeenScanId: scanId,
          createdAt: startedAt,
          updatedAt: startedAt,
        })
        .onConflictDoUpdate({
          target: [schema.findings.projectId, schema.findings.dedupeKey],
          set: {
            scanId,
            severity: detector.severity,
            descriptionMd: describe(detector),
            suggestedFixMd: detector.recommendation,
            score: detector.score,
            lastSeenScanId: scanId,
            updatedAt: new Date(),
          },
        });

      bySeverity[detector.severity] += 1;
      results.push({ findingId, fileLabel: file.label, detector });
    }

    const total = results.length;
    await db
      .update(schema.scans)
      .set({
        status: 'succeeded',
        finishedAt: new Date(),
        summary: { totalFindings: total, bySeverity },
      })
      .where(eqId(scanId));

    return { scanId, totalFindings: total, bySeverity, results };
  } catch (err) {
    await db
      .update(schema.scans)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      })
      .where(eqId(scanId));
    throw err;
  }
}

function titleFor(label: string, d: DetectorResult): string {
  const tag = d.severity.toUpperCase();
  return `[${tag}] Business logic in SQL — ${label} (score ${d.score})`;
}

function describe(d: DetectorResult): string {
  const lines: string[] = [];
  lines.push(`**Score:** ${d.score} → severity \`${d.severity}\``);
  lines.push(`**Dialect:** ${d.dialect}${d.parseOk ? '' : ' (regex fallback)'}`);
  if (d.signals.length > 0) {
    lines.push('');
    lines.push('**Signals detected:**');
    for (const s of d.signals) {
      lines.push(
        `- ${s.label}: count=${s.count}, contribution=${s.capped}${
          s.capped < s.raw ? ` (capped from ${s.raw})` : ''
        }`
      );
    }
  } else {
    lines.push('');
    lines.push('No high-weight signals; severity driven by aggregate score.');
  }
  return lines.join('\n');
}

import { eq } from 'drizzle-orm';
function eqId(id: string) {
  return eq(schema.scans.id, id);
}
