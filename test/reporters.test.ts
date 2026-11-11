import { describe, expect, it } from 'vitest';
import { renderHtml } from '../src/reporters/html.ts';
import { renderJson } from '../src/reporters/json.ts';
import { renderTerminal } from '../src/reporters/terminal.ts';
import type { Report } from '../src/types.ts';

const report: Report = {
  tool: { name: 'siteaudit', version: '0.0.0' },
  target: 'https://site.test',
  origin: 'https://site.test',
  startedAt: '2026-01-01T00:00:00.000Z',
  durationMs: 1234,
  score: 82,
  summary: { pages: 2, errors: 1, warnings: 1, infos: 0 },
  rules: [
    { id: 'img-alt', severity: 'error', category: 'a11y', description: 'd', docs: 'h' },
    { id: 'title-length', severity: 'warn', category: 'seo', description: 'd', docs: 'h' },
  ],
  pages: [
    {
      url: 'https://site.test/about',
      status: 200,
      depth: 1,
      score: 84,
      issues: [
        { ruleId: 'img-alt', severity: 'error', url: 'https://site.test/about', message: 'Image has no alt attribute', snippet: '<img src="x"></script><script>alert(1)</script>' },
        { ruleId: 'title-length', severity: 'warn', url: 'https://site.test/about', message: 'Title is 4 characters' },
      ],
    },
    { url: 'https://site.test/', status: 200, depth: 0, score: 100, issues: [] },
  ],
};

describe('renderTerminal', () => {
  const output = renderTerminal(report, { color: false });
  it('groups issues under page paths and ends with totals', () => {
    expect(output).toContain('/about  score 84');
    expect(output).toMatch(/✖ error {2}Image has no alt attribute\s+img-alt/);
    expect(output).toContain('✔ 1 page passed every check');
    expect(output).toContain('✖ 1 error   ▲ 1 warning   ● 0 info   score 82/100');
  });
  it('emits no ANSI codes when color is off', () => {
    expect(output).not.toContain('\x1b[');
  });
  it('strips control characters from crawled text so pages cannot inject escape sequences', () => {
    const [first] = report.pages;
    const issue = first?.issues[0];
    if (first === undefined || issue === undefined) throw new Error('fixture changed');
    const hostile: Report = {
      ...report,
      pages: [{ ...first, issues: [{ ...issue, message: 'Bad \x1b[2J\x1b]0;pwned\x07title\u009b31m', snippet: 'a\rb\tc' }] }],
    };
    const text = renderTerminal(hostile, { color: false });
    expect(text).toContain('Bad [2J]0;pwnedtitle31m');
    expect(text).toContain('ab\tc');
    expect(text).not.toContain('\x1b');
    expect(text).not.toContain('\x07');
    expect(text).not.toContain('\u009b');
  });
});

describe('renderJson', () => {
  it('round-trips the report', () => {
    expect(JSON.parse(renderJson(report))).toEqual(report);
  });
});

describe('renderHtml', () => {
  const html = renderHtml(report);
  it('is a standalone document with the data embedded', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/<link[^>]+stylesheet|<script[^>]+src=/);
    const json = /<script id="report-data" type="application\/json">(.*?)<\/script>/s.exec(html)?.[1];
    expect(JSON.parse(json ?? '')).toEqual(report);
  });
  it('cannot be broken out of by crawled content', () => {
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html.match(/<\/script>/g)).toHaveLength(2);
  });
});
