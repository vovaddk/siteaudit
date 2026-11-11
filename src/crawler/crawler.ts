import robotsParserModule from 'robots-parser';
import type { FetchRecord, Page, Site } from '../types.ts';
import { fetchUrl, type FetchOptions } from './fetch.ts';
import { mapLimit } from './map-limit.ts';
import { createPage, resolveUrl } from './page.ts';
import { parseSitemap } from './sitemap.ts';

// robots-parser is CommonJS (`module.exports = fn`) but its typings declare a default export.
const robotsParser = robotsParserModule as unknown as typeof robotsParserModule.default;

/** Upper bound on sitemap files fetched, since sitemap indexes can fan out. */
const MAX_SITEMAP_FILES = 20;

export interface CrawlOptions {
  maxPages: number;
  maxDepth: number;
  concurrency: number;
  timeoutMs: number;
  respectRobots: boolean;
  userAgent: string;
  /** URLs for which this returns true are neither crawled nor checked. */
  isIgnored: (url: string) => boolean;
  /**
   * The site is a local folder served from 127.0.0.1. Its sitemap lists the production domain,
   * so sitemap URLs are rebased onto the crawled origin, keeping only path and query.
   */
  local?: boolean;
  onPage?: (page: Page) => void;
}

const isHtml = (record: FetchRecord): boolean =>
  record.status >= 200 && record.status < 300 && /html/i.test(record.contentType ?? 'text/html');

/** Breadth-first crawl of `startUrl`'s origin. Never throws for HTTP-level failures. */
export async function crawl(startUrl: string, options: CrawlOptions): Promise<Site> {
  const fetchOptions = (method: FetchOptions['method']): FetchOptions => ({
    method,
    timeoutMs: options.timeoutMs,
    userAgent: options.userAgent,
  });
  const fetched = new Map<string, FetchRecord>();
  const pages: Page[] = [];
  const pageUrls = new Set<string>();
  const queued = new Set<string>();
  const start = resolveUrl(startUrl, startUrl);
  if (start === undefined) throw new Error(`Not an http(s) URL: ${startUrl}`);

  let origin = new URL(start).origin;
  let isAllowed: (url: string) => boolean = () => true;
  const inScope = (url: string): boolean =>
    new URL(url).origin === origin && !options.isIgnored(url) && isAllowed(url);
  const rebase = (url: string): string => {
    if (options.local !== true) return url;
    const { pathname, search } = new URL(url);
    return new URL(pathname + search, origin).href;
  };

  const visit = async (url: string, depth: number): Promise<Page | undefined> => {
    const { record, headers, body } = await fetchUrl(url, fetchOptions('GET'));
    fetched.set(url, record);
    // The start URL may redirect (http -> https, apex -> www); its final origin is the one to crawl.
    if (depth === 0) origin = new URL(record.finalUrl).origin;
    const sameOrigin = new URL(record.finalUrl).origin === origin;
    if (body === undefined || !isHtml(record) || !sameOrigin || pageUrls.has(record.finalUrl)) return undefined;
    pageUrls.add(record.finalUrl);
    // A redirected URL is also known under its final address, so links to it are not re-fetched.
    if (!fetched.has(record.finalUrl)) fetched.set(record.finalUrl, { ...record, url: record.finalUrl, redirects: [] });
    return createPage({ url: record.finalUrl, html: body, status: record.status, depth, headers });
  };

  const loadRobots = async (): Promise<string[]> => {
    const robotsUrl = `${origin}/robots.txt`;
    const { record, body } = await fetchUrl(robotsUrl, fetchOptions('GET'));
    if (record.status !== 200 || body === undefined) return [];
    const robots = robotsParser(robotsUrl, body);
    if (options.respectRobots) isAllowed = (url) => robots.isAllowed(url, options.userAgent) !== false;
    return robots.getSitemaps().map(rebase);
  };

  const loadSitemap = async (locations: string[]): Promise<Set<string> | undefined> => {
    const todo = locations.length > 0 ? [...locations] : [`${origin}/sitemap.xml`];
    let urls: Set<string> | undefined;
    // for...of also visits child sitemaps pushed while iterating.
    for (const [index, location] of todo.entries()) {
      if (index === MAX_SITEMAP_FILES) break;
      const { record, body } = await fetchUrl(location, fetchOptions('GET'));
      if (record.status !== 200 || body === undefined) continue;
      const parsed = parseSitemap(body, location);
      todo.push(...parsed.sitemaps.map(rebase));
      urls ??= new Set();
      for (const url of parsed.urls) urls.add(rebase(url));
    }
    return urls;
  };

  let sitemap: Set<string> | undefined;
  let frontier = [start];
  queued.add(start);
  for (let depth = 0; frontier.length > 0 && depth <= options.maxDepth && pages.length < options.maxPages; depth++) {
    // Refill until the page budget is spent: 404s, non-HTML and duplicates do not count as pages.
    const levelPages: Page[] = [];
    for (let offset = 0; offset < frontier.length && pages.length < options.maxPages; ) {
      const batch = frontier.slice(offset, offset + options.maxPages - pages.length);
      offset += batch.length;
      const visited = await mapLimit(batch, options.concurrency, (url) => visit(url, depth));
      for (const page of visited) {
        if (page === undefined) continue;
        pages.push(page);
        levelPages.push(page);
        options.onPage?.(page);
      }
    }

    const next: string[] = [];
    const enqueue = (url: string): void => {
      if (queued.has(url) || !inScope(url)) return;
      queued.add(url);
      next.push(url);
    };

    if (depth === 0) sitemap = await loadSitemap(await loadRobots());
    for (const page of levelPages) page.links.forEach(enqueue);
    if (depth === 0) sitemap?.forEach(enqueue);
    frontier = next;
  }

  // Check every internal link and image that was not crawled, plus the default favicon.
  const extra = new Set<string>([`${origin}/favicon.ico`]);
  for (const page of pages) {
    for (const link of page.links) if (inScope(link)) extra.add(link);
    for (const image of page.images) if (!options.isIgnored(image)) extra.add(image);
  }
  const unchecked = [...extra].filter((url) => !fetched.has(url));
  const records = await mapLimit(unchecked, options.concurrency, async (url) => (await fetchUrl(url, fetchOptions('HEAD'))).record);
  for (const record of records) fetched.set(record.url, record);

  return { origin, local: options.local === true, pages, sitemap, fetched };
}
