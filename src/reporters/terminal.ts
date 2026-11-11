import { createColors } from 'picocolors';
import type { Issue, Report, Severity } from '../types.ts';
import { displayUrl, siteName } from './format.ts';

const LABEL: Record<Severity, string> = { error: 'error', warn: 'warn ', info: 'info ' };
const SYMBOL: Record<Severity, string> = { error: '✖', warn: '▲', info: '●' };

/**
 * Messages and snippets quote crawled pages. Strip control characters (C0 except tab, DEL, C1) so a
 * page cannot inject ANSI/OSC escape sequences into the terminal or CI log.
 */
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL_CHARS = /[\u0000-\u0008\u000a-\u001f\u007f-\u009f]/g;
export const sanitize = (text: string): string => text.replace(CONTROL_CHARS, '');

const plural = (count: number, word: string): string => `${String(count)} ${word}${count === 1 ? '' : 's'}`;

/** Human-readable summary grouped by page, ESLint style. */
export function renderTerminal(report: Report, { color = true }: { color?: boolean } = {}): string {
  const c = createColors(color);
  const paint: Record<Severity, (text: string) => string> = { error: c.red, warn: c.yellow, info: c.blue };
  const scoreColor = (score: number): string =>
    (score >= 90 ? c.green : score >= 70 ? c.yellow : c.red)(String(score));
  const lines: string[] = [
    '',
    `${c.bold('siteaudit')} ${c.dim(report.tool.version)}  ${siteName(report)}  ${c.dim(
      `${plural(report.summary.pages, 'page')} in ${(report.durationMs / 1000).toFixed(1)}s`,
    )}`,
  ];

  const issueLine = (issue: Issue, width: number): string[] => {
    const head = `  ${paint[issue.severity](`${SYMBOL[issue.severity]} ${LABEL[issue.severity]}`)}  ${sanitize(issue.message).padEnd(width)}  ${c.dim(sanitize(issue.ruleId))}`;
    return issue.snippet === undefined ? [head] : [head, `            ${c.dim(sanitize(issue.snippet))}`];
  };

  let clean = 0;
  for (const page of report.pages) {
    if (page.issues.length === 0) {
      clean++;
      continue;
    }
    const width = Math.min(70, Math.max(...page.issues.map((issue) => sanitize(issue.message).length)));
    lines.push('', `${c.underline(displayUrl(page.url, report.origin))}  ${c.dim('score')} ${scoreColor(page.score)}`);
    for (const issue of page.issues) lines.push(...issueLine(issue, width));
  }
  if (clean > 0) lines.push('', c.green(`✔ ${plural(clean, 'page')} passed every check`));

  const { errors, warnings, infos } = report.summary;
  lines.push(
    '',
    [
      paint.error(`${SYMBOL.error} ${plural(errors, 'error')}`),
      paint.warn(`${SYMBOL.warn} ${plural(warnings, 'warning')}`),
      paint.info(`${SYMBOL.info} ${String(infos)} info`),
      `${c.bold('score')} ${scoreColor(report.score)}${c.dim('/100')}`,
    ].join('   '),
    '',
  );
  return lines.join('\n');
}
