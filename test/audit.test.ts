import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { audit } from '../src/audit.ts';
import { mergeConfig } from '../src/config/config.ts';

const DEMO = fileURLToPath(new URL('../examples/demo-site', import.meta.url));

describe('audit (local folder, end to end)', () => {
  it('finds the deliberate issues in the demo site', async () => {
    const report = await audit(DEMO, mergeConfig());
    const fired = (path: string): string[] =>
      report.pages.find((page) => new URL(page.url).pathname === path)?.issues.map((issue) => issue.ruleId) ?? [];

    expect(report.pages.map((page) => new URL(page.url).pathname).sort()).toEqual(
      ['/', '/about', '/blog/', '/blog/first-post', '/contact', '/pricing'],
    );
    expect(fired('/')).toEqual(expect.arrayContaining(['img-alt', 'broken-link', 'image-size', 'render-blocking-script']));
    expect(fired('/about')).toEqual(expect.arrayContaining(['title-duplicate', 'meta-description-missing', 'heading-order']));
    expect(fired('/pricing')).toEqual(expect.arrayContaining(['h1-single', 'link-name', 'button-name']));
    expect(fired('/contact')).toEqual(expect.arrayContaining(['html-lang', 'viewport', 'noindex', 'form-label']));
    expect(fired('/blog/first-post')).toEqual(expect.arrayContaining(['title-length', 'canonical-mismatch', 'sitemap-coverage']));
    expect(fired('/blog/')).toEqual([]);
    expect(report.summary.errors).toBeGreaterThan(0);
  });

  it('applies rule settings and ignore patterns from config', async () => {
    const report = await audit(DEMO, mergeConfig({ ignore: ['/blog/**'], rules: { 'img-alt': 'off', 'broken-link': 'info' } }));
    const issues = report.pages.flatMap((page) => page.issues);
    expect(report.pages.some((page) => page.url.includes('/blog/'))).toBe(false);
    expect(issues.some((issue) => issue.ruleId === 'img-alt')).toBe(false);
    expect(issues.find((issue) => issue.ruleId === 'broken-link')?.severity).toBe('info');
  });

  it('rejects targets that are neither URLs nor folders', async () => {
    await expect(audit('./definitely-not-here', mergeConfig())).rejects.toThrow('neither an http(s) URL nor an existing folder');
  });
});
