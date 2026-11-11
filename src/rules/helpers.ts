import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import type { Page } from '../types.ts';

const SNIPPET_MAX = 120;

/** Collapsed, truncated outer HTML of an element, for issue snippets. */
export function snippet($: CheerioAPI, el: Cheerio<Element>): string {
  const html = ($.html(el.first()) || '').replace(/\s+/g, ' ').trim();
  return html.length > SNIPPET_MAX ? `${html.slice(0, SNIPPET_MAX - 1)}…` : html;
}

/** Path + query of a URL, for readable messages. */
export function pathOf(url: string): string {
  const { pathname, search } = new URL(url);
  return pathname + search;
}

const clean = (text: string | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim();

/**
 * Approximates the accessible name of an element (WAI-ARIA accname, simplified):
 * aria-labelledby, aria-label, text content incl. `<img alt>` and `<svg><title>`, input value, then `title`.
 */
export function accessibleName($: CheerioAPI, el: Cheerio<Element>): string {
  const labelledBy = clean(el.attr('aria-labelledby'));
  if (labelledBy !== '') {
    const ids = new Set(labelledBy.split(' '));
    const name = clean($('[id]').filter((_, node) => ids.has($(node).attr('id') ?? '')).text());
    if (name !== '') return name;
  }
  const label = clean(el.attr('aria-label'));
  if (label !== '') return label;
  const copy = el.clone();
  copy.find('[aria-hidden="true"]').remove();
  copy.find('img[alt]').each((_, img) => {
    $(img).replaceWith(` ${$(img).attr('alt') ?? ''} `);
  });
  const text = clean(copy.text());
  if (text !== '') return text;
  if (el.is('input')) {
    const value = clean(el.attr('value'));
    if (value !== '') return value;
  }
  return clean(el.attr('title'));
}

/** Caches a per-page derived value, so cross-page rules stay linear instead of quadratic. */
function perPage<T>(compute: (page: Page) => T): (page: Page) => T {
  const cache = new WeakMap<Page, T>();
  return (page) => {
    if (!cache.has(page)) cache.set(page, compute(page));
    return cache.get(page) as T;
  };
}

/** Trimmed text of `<head><title>`; `<svg><title>` in the body is ignored. */
export const titleOf = perPage((page) => page.$('head > title').first().text().trim());

/** Trimmed `content` of `<meta name="description">`. */
export const descriptionOf = perPage((page) =>
  (page.$('meta[name="description" i]').first().attr('content') ?? '').trim(),
);

/** Unique same-origin links of a page. */
export const internalLinks = (page: Page, origin: string): string[] =>
  [...new Set(page.links)].filter((link) => new URL(link).origin === origin);
