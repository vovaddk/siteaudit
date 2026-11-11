import { resolveUrl } from '../crawler/page.ts';
import type { Rule } from '../types.ts';
import { pathOf } from './helpers.ts';

/** Drops a trailing slash (except on the root path) so `/about` and `/about/` compare equal. */
const normalize = (url: string): string => {
  const parsed = new URL(url);
  if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.href;
};

export const canonicalMismatch: Rule = {
  id: 'canonical-mismatch',
  severity: 'warn',
  category: 'seo',
  description: 'Canonical URL points at the page itself.',
  docs: 'A canonical pointing elsewhere asks search engines to index the other URL instead. Make sure that is intended.',
  check(page, site) {
    const href = page.$('link[rel~="canonical" i]').attr('href');
    const canonical = href === undefined ? undefined : resolveUrl(href, page.url);
    if (canonical === undefined) return [];
    // A local folder is served from 127.0.0.1 but declares the production domain, so only paths can match.
    const same = site.local
      ? pathOf(normalize(canonical)) === pathOf(normalize(page.url))
      : normalize(canonical) === normalize(page.url);
    if (same) return [];
    const shown = new URL(canonical).origin === site.origin ? pathOf(canonical) : canonical;
    return [{ message: `Canonical points to ${shown}, not to this page`, snippet: canonical }];
  },
};
