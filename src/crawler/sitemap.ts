import { load } from 'cheerio';
import { resolveUrl } from './page.ts';

export interface ParsedSitemap {
  /** Page URLs from a `<urlset>`. */
  urls: string[];
  /** Child sitemap URLs from a `<sitemapindex>`. */
  sitemaps: string[];
}

/** Parses a sitemap or sitemap index document. Unknown documents yield empty lists. */
export function parseSitemap(xml: string, base: string): ParsedSitemap {
  const $ = load(xml, { xml: true });
  const locs = (selector: string): string[] =>
    $(selector)
      // Cheerio's map() drops undefined results, i.e. unresolvable <loc> values.
      .map((_, el) => resolveUrl($(el).text(), base))
      .get();
  return { urls: locs('urlset > url > loc'), sitemaps: locs('sitemapindex > sitemap > loc') };
}
