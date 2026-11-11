import { load } from 'cheerio';
import type { Page } from '../types.ts';

export interface PageInput {
  url: string;
  html: string;
  status?: number;
  depth?: number;
  headers?: Record<string, string>;
}

/** Resolves `href` against `base`; returns an absolute http(s) URL without hash, or undefined. */
export function resolveUrl(href: string, base: string): string | undefined {
  const trimmed = href.trim();
  if (trimmed === '' || trimmed.startsWith('#')) return undefined;
  let url: URL;
  try {
    url = new URL(trimmed, base);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  url.hash = '';
  return url.href;
}

function collect(values: (string | undefined)[], base: string): string[] {
  return values.flatMap((value) => {
    const url = value === undefined ? undefined : resolveUrl(value, base);
    return url === undefined ? [] : [url];
  });
}

/** Parses HTML once and precomputes what rules and the crawler need. */
export function createPage({ url, html, status = 200, depth = 0, headers = {} }: PageInput): Page {
  const $ = load(html);
  const baseHref = $('base[href]').attr('href');
  const base = (baseHref !== undefined ? resolveUrl(baseHref, url) : undefined) ?? url;
  return {
    url,
    status,
    depth,
    headers,
    html,
    $,
    links: collect($('a[href]').map((_, el) => $(el).attr('href')).get(), base),
    images: collect($('img[src]').map((_, el) => $(el).attr('src')).get(), base),
  };
}
