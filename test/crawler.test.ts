import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crawl, type CrawlOptions } from '../src/crawler/crawler.ts';
import { parseSitemap } from '../src/crawler/sitemap.ts';

const html = (body: string): string => `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`;

let server: Server;
let origin: string;
const hits = new Map<string, number>();

/** Fixture site: robots.txt, nested sitemaps, a redirect chain, a 404 and a deep link chain. */
const routes: Record<string, (method: string) => { status: number; headers?: Record<string, string>; body?: string }> = {
  '/': () => ({
    status: 200,
    body: html(`
      <a href="/a">a</a> <a href="/a#section">a again</a> <a href="/hop1">chain</a> <a href="/missing">missing</a>
      <a href="/blocked/page">blocked</a> <a href="/deep1">deep</a> <a href="/private/x">ignored</a>
      <a href="https://external.test/">external</a> <a href="mailto:hi@site.test">mail</a>
      <img src="/hero.png" alt="">`),
  }),
  '/a': () => ({ status: 200, body: html('<a href="/">home</a>') }),
  '/hop1': () => ({ status: 301, headers: { location: '/hop2' } }),
  '/hop2': () => ({ status: 302, headers: { location: '/a' } }),
  '/blocked/page': () => ({ status: 200, body: html('secret') }),
  '/private/x': () => ({ status: 200, body: html('private') }),
  '/deep1': () => ({ status: 200, body: html('<a href="/deep2">2</a>') }),
  '/deep2': () => ({ status: 200, body: html('<a href="/deep3">3</a>') }),
  '/deep3': () => ({ status: 200, body: html('end') }),
  '/only-in-sitemap': () => ({ status: 200, body: html('listed') }),
  '/budget': () => ({
    status: 200,
    body: html(['/gone1', '/gone2', '/gone3', '/g1', '/g2', '/g3', '/g4', '/g5'].map((path) => `<a href="${path}">x</a>`).join('')),
  }),
  '/g1': () => ({ status: 200, body: html('g') }),
  '/g2': () => ({ status: 200, body: html('g') }),
  '/g3': () => ({ status: 200, body: html('g') }),
  '/g4': () => ({ status: 200, body: html('g') }),
  '/g5': () => ({ status: 200, body: html('g') }),
  '/hero.png': (method) => ({
    status: method === 'HEAD' ? 200 : 405,
    headers: { 'content-type': 'image/png', 'content-length': '300000' },
  }),
  '/robots.txt': () => ({
    status: 200,
    headers: { 'content-type': 'text/plain' },
    body: `User-agent: *\nDisallow: /blocked/\nSitemap: ${origin}/sitemap-index.xml\n`,
  }),
  '/sitemap-index.xml': () => ({
    status: 200,
    headers: { 'content-type': 'application/xml' },
    body: `<?xml version="1.0"?><sitemapindex><sitemap><loc>${origin}/sitemap-pages.xml</loc></sitemap></sitemapindex>`,
  }),
  '/sitemap-pages.xml': () => ({
    status: 200,
    headers: { 'content-type': 'application/xml' },
    body: `<?xml version="1.0"?><urlset><url><loc>${origin}/</loc></url><url><loc>${origin}/only-in-sitemap</loc></url></urlset>`,
  }),
};

beforeAll(async () => {
  server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://x').pathname;
    hits.set(path, (hits.get(path) ?? 0) + 1);
    const route = routes[path];
    const { status, headers = {}, body } = route ? route(request.method ?? 'GET') : { status: 404, body: 'nope' };
    response.writeHead(status, { 'content-type': 'text/html', ...headers });
    response.end(request.method === 'HEAD' ? undefined : body);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});
afterAll(() => {
  server.close();
});
beforeEach(() => {
  hits.clear();
});

const options = (overrides: Partial<CrawlOptions> = {}): CrawlOptions => ({
  maxPages: 50,
  maxDepth: 5,
  concurrency: 4,
  timeoutMs: 5000,
  respectRobots: true,
  userAgent: 'siteaudit-test',
  isIgnored: (url) => new URL(url).pathname.startsWith('/private/'),
  ...overrides,
});
const paths = (urls: Iterable<string>): string[] => [...urls].map((url) => new URL(url).pathname);

describe('crawl', () => {
  it('crawls same-origin pages breadth-first, including pages found only in the sitemap', async () => {
    const site = await crawl(`${origin}/`, options());
    expect(paths(site.pages.map((page) => page.url))).toEqual(['/', '/a', '/deep1', '/only-in-sitemap', '/deep2', '/deep3']);
    expect(site.pages.map((page) => page.depth)).toEqual([0, 1, 1, 1, 2, 3]);
    expect(site.origin).toBe(origin);
  });

  it('reads robots.txt rules and nested sitemaps', async () => {
    const site = await crawl(`${origin}/`, options());
    expect(hits.has('/blocked/page')).toBe(false);
    expect(paths(site.sitemap ?? [])).toEqual(['/', '/only-in-sitemap']);
  });

  it('crawls disallowed pages when robots.txt is ignored', async () => {
    const site = await crawl(`${origin}/`, options({ respectRobots: false }));
    expect(paths(site.pages.map((page) => page.url))).toContain('/blocked/page');
  });

  it('never requests ignored or external URLs', async () => {
    await crawl(`${origin}/`, options());
    expect(hits.has('/private/x')).toBe(false);
    expect([...hits.keys()].every((path) => path.startsWith('/'))).toBe(true);
  });

  it('records redirect chains and broken links', async () => {
    const site = await crawl(`${origin}/`, options());
    const chain = site.fetched.get(`${origin}/hop1`);
    expect(paths(chain?.redirects ?? [])).toEqual(['/hop1', '/hop2']);
    expect(chain?.finalUrl).toBe(`${origin}/a`);
    expect(site.fetched.get(`${origin}/missing`)?.status).toBe(404);
    // /a was reached twice (directly and via the chain) but is audited once.
    expect(site.pages.filter((page) => page.url === `${origin}/a`)).toHaveLength(1);
  });

  it('checks images with HEAD and records their size', async () => {
    const site = await crawl(`${origin}/`, options());
    expect(site.fetched.get(`${origin}/hero.png`)?.contentLength).toBe(300000);
  });

  it('respects maxDepth and maxPages, but still checks links it did not crawl', async () => {
    const shallow = await crawl(`${origin}/`, options({ maxDepth: 1 }));
    expect(paths(shallow.pages.map((page) => page.url))).not.toContain('/deep2');

    const capped = await crawl(`${origin}/`, options({ maxPages: 2 }));
    expect(capped.pages).toHaveLength(2);
    expect(capped.fetched.get(`${origin}/missing`)?.status).toBe(404);
  });

  it('follows a redirect on the start URL to another origin and crawls that origin', async () => {
    const target = createServer((_, response) => {
      response.writeHead(200, { 'content-type': 'text/html' }).end(html('moved here'));
    });
    await new Promise<void>((done) => target.listen(0, '127.0.0.1', done));
    const targetOrigin = `http://127.0.0.1:${String((target.address() as AddressInfo).port)}`;
    routes['/moved'] = () => ({ status: 301, headers: { location: `${targetOrigin}/` } });
    try {
      const site = await crawl(`${origin}/moved`, options());
      expect(site.origin).toBe(targetOrigin);
      expect(site.pages.map((page) => page.url)).toEqual([`${targetOrigin}/`]);
    } finally {
      target.close();
    }
  });

  it('does not spend the page budget on broken links', async () => {
    const site = await crawl(`${origin}/budget`, options({ maxPages: 5, concurrency: 2 }));
    expect(paths(site.pages.map((page) => page.url))).toEqual(['/budget', '/g1', '/g2', '/g3', '/g4']);
    expect(site.fetched.get(`${origin}/gone1`)?.status).toBe(404);
  });

  it('reports network failures instead of throwing', async () => {
    const site = await crawl('http://127.0.0.1:9/', options({ timeoutMs: 2000 }));
    expect(site.pages).toEqual([]);
    expect(site.fetched.get('http://127.0.0.1:9/')?.status).toBe(0);
  });
});

describe('parseSitemap', () => {
  it('reads urlsets and sitemap indexes and resolves relative locations', () => {
    expect(parseSitemap('<urlset><url><loc> /a </loc></url><url><loc>https://x.test/b</loc></url></urlset>', 'https://x.test/sitemap.xml'))
      .toEqual({ urls: ['https://x.test/a', 'https://x.test/b'], sitemaps: [] });
    expect(parseSitemap('<sitemapindex><sitemap><loc>https://x.test/s1.xml</loc></sitemap></sitemapindex>', 'https://x.test/'))
      .toEqual({ urls: [], sitemaps: ['https://x.test/s1.xml'] });
    expect(parseSitemap('not xml at all', 'https://x.test/')).toEqual({ urls: [], sitemaps: [] });
  });
});
