import type { FailOn } from './config/config.ts';
import type { Issue, PageReport, Rule, Severity, Site, Summary } from './types.ts';

/** Score penalty per distinct failing rule on a page, so 40 images without alt do not zero a page alone. */
const SEVERITY_WEIGHT: Record<Severity, number> = { error: 12, warn: 4, info: 1 };

/** 100 minus the weight of each distinct failing rule, floored at 0. */
export function scorePage(issues: readonly Issue[]): number {
  const failing = new Map(issues.map((issue) => [issue.ruleId, issue.severity]));
  let penalty = 0;
  for (const severity of failing.values()) penalty += SEVERITY_WEIGHT[severity];
  return Math.max(0, 100 - penalty);
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warn: 1, info: 2 };

/** Runs every rule against every page; issues are ordered by severity, then rule order. */
export function runRules(site: Site, rules: readonly Rule[]): PageReport[] {
  return site.pages.map((page) => {
    const issues = rules.flatMap((rule) => {
      let findings;
      try {
        findings = rule.check(page, site);
      } catch (error) {
        throw new Error(`Rule "${rule.id}" crashed on ${page.url}`, { cause: error });
      }
      return findings.map((finding): Issue => ({ ...finding, ruleId: rule.id, severity: rule.severity, url: page.url }));
    });
    issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    return { url: page.url, status: page.status, depth: page.depth, score: scorePage(issues), issues };
  });
}

export function summarize(pages: readonly PageReport[]): Summary {
  const count = (severity: Severity): number =>
    pages.reduce((total, page) => total + page.issues.filter((issue) => issue.severity === severity).length, 0);
  return { pages: pages.length, errors: count('error'), warnings: count('warn'), infos: count('info') };
}

/** Mean page score, rounded. */
export function overallScore(pages: readonly PageReport[]): number {
  if (pages.length === 0) return 0;
  return Math.round(pages.reduce((total, page) => total + page.score, 0) / pages.length);
}

/** 1 when the summary reaches the `failOn` threshold, else 0. */
export function exitCodeFor(summary: Summary, failOn: FailOn): 0 | 1 {
  if (failOn === 'none') return 0;
  const failing = failOn === 'warn' ? summary.errors + summary.warnings : summary.errors;
  return failing > 0 ? 1 : 0;
}
