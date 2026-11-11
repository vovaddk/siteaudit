import { describe, expect, it } from 'vitest';
import { exitCodeFor, overallScore, runRules, scorePage, summarize } from '../src/engine.ts';
import type { Issue, Rule } from '../src/types.ts';
import { doc, page, site } from './helpers.ts';

const issue = (ruleId: string, severity: Issue['severity']): Issue => ({ ruleId, severity, message: 'm', url: 'https://site.test/' });

describe('scorePage', () => {
  it('is 100 without issues and charges each failing rule once', () => {
    expect(scorePage([])).toBe(100);
    expect(scorePage([issue('a', 'error'), issue('a', 'error'), issue('b', 'warn'), issue('c', 'info')])).toBe(100 - 12 - 4 - 1);
  });
  it('never goes below 0', () => {
    expect(scorePage(Array.from({ length: 20 }, (_, i) => issue(`r${String(i)}`, 'error')))).toBe(0);
  });
});

describe('runRules', () => {
  const always = (id: string, severity: Issue['severity']): Rule => ({
    id,
    severity,
    category: 'quality',
    description: id,
    docs: id,
    check: () => [{ message: id }],
  });

  it('attaches rule id, severity and URL, and sorts issues by severity', () => {
    const [report] = runRules(site([page(doc())]), [always('i', 'info'), always('e', 'error'), always('w', 'warn')]);
    expect(report?.issues.map((i) => `${i.severity}:${i.ruleId}`)).toEqual(['error:e', 'warn:w', 'info:i']);
    expect(report?.issues[0]?.url).toBe('https://site.test/');
    expect(report?.score).toBe(100 - 12 - 4 - 1);
  });

  it('names the rule and page when a rule throws', () => {
    const broken: Rule = { ...always('boom', 'error'), check: () => { throw new Error('bad'); } };
    expect(() => runRules(site([page(doc())]), [broken])).toThrow('Rule "boom" crashed on https://site.test/');
  });
});

describe('summarize and overallScore', () => {
  const pages = [
    { url: 'a', status: 200, depth: 0, score: 80, issues: [issue('x', 'error'), issue('y', 'warn')] },
    { url: 'b', status: 200, depth: 1, score: 95, issues: [issue('z', 'info')] },
  ];
  it('counts issues by severity', () => {
    expect(summarize(pages)).toEqual({ pages: 2, errors: 1, warnings: 1, infos: 1 });
  });
  it('averages page scores', () => {
    expect(overallScore(pages)).toBe(88);
    expect(overallScore([])).toBe(0);
  });
});

describe('exitCodeFor', () => {
  const summary = (errors: number, warnings: number, infos = 0) => ({ pages: 1, errors, warnings, infos });
  it.each([
    ['error', summary(0, 5, 3), 0],
    ['error', summary(1, 0), 1],
    ['warn', summary(0, 1), 1],
    ['warn', summary(0, 0, 9), 0],
    ['none', summary(9, 9, 9), 0],
  ] as const)('--fail-on %s with %j -> %i', (failOn, counts, expected) => {
    expect(exitCodeFor(counts, failOn)).toBe(expected);
  });
});
