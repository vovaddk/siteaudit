import { createPage } from '../src/crawler/page.ts';
import type { FetchRecord, Finding, Page, Rule, Site } from '../src/types.ts';

export const ORIGIN = 'https://site.test';

/** Minimal HTML document; pass `lang: null` to omit the attribute. */
export function doc(head = '', body = '', { lang = 'en' }: { lang?: string | null } = {}): string {
  const langAttr = lang === null ? '' : ` lang="${lang}"`;
  return `<!doctype html><html${langAttr}><head>${head}</head><body>${body}</body></html>`;
}

export function page(html: string, path = '/', headers: Record<string, string> = {}): Page {
  return createPage({ url: new URL(path, ORIGIN).href, html, headers });
}

export function record(url: string, overrides: Partial<FetchRecord> = {}): FetchRecord {
  return { url, finalUrl: url, status: 200, redirects: [], ...overrides };
}

export function site(pages: Page[], overrides: Partial<Site> = {}): Site {
  return { origin: ORIGIN, local: false, pages, sitemap: undefined, fetched: new Map(), ...overrides };
}

/** Runs `rule` against `target`, inside a site made of `target` plus `others`. */
export function check(rule: Rule, target: Page, context: Partial<Site> & { others?: Page[] } = {}): Finding[] {
  const { others = [], ...overrides } = context;
  return rule.check(target, site([target, ...others], overrides));
}
