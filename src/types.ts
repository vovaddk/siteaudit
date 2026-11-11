import type { CheerioAPI } from 'cheerio';

export type Severity = 'error' | 'warn' | 'info';
export type RuleCategory = 'seo' | 'a11y' | 'quality';

/** Result of fetching one URL (page, link target or image), after following redirects. */
export interface FetchRecord {
  /** URL that was requested (hash stripped). */
  url: string;
  /** URL after redirects. */
  finalUrl: string;
  /** HTTP status of the final response; 0 when the request failed (DNS, timeout, ...). */
  status: number;
  /** Every URL that answered with a redirect, in order. Empty when there was none. */
  redirects: string[];
  contentType?: string;
  contentLength?: number;
  error?: string;
}

/** A crawled HTML page, parsed once and shared by every rule. */
export interface Page {
  /** Final URL of the page (after redirects). */
  url: string;
  status: number;
  depth: number;
  headers: Readonly<Record<string, string>>;
  html: string;
  $: CheerioAPI;
  /** Absolute http(s) URLs of `<a href>` targets, hash stripped, in document order. */
  links: string[];
  /** Absolute URLs of `<img src>`, in document order. */
  images: string[];
}

/** Everything known about the crawled site; lets rules reason across pages. */
export interface Site {
  origin: string;
  /** True for a local folder served from 127.0.0.1, whose pages still reference the production domain. */
  local: boolean;
  pages: readonly Page[];
  /** URLs listed in sitemap.xml, or undefined when the site has no sitemap. */
  sitemap: ReadonlySet<string> | undefined;
  /** Fetch results for pages, internal links, images and probes, keyed by requested URL. */
  fetched: ReadonlyMap<string, FetchRecord>;
}

export interface Finding {
  message: string;
  /** Short excerpt of the offending markup or URL. */
  snippet?: string;
}

export interface Rule {
  id: string;
  severity: Severity;
  category: RuleCategory;
  description: string;
  /** One-line hint on how to fix the issue. */
  docs: string;
  /** Pure: must not mutate the page or site, and must not perform I/O. */
  check(page: Page, site: Site): Finding[];
}

export interface Issue extends Finding {
  ruleId: string;
  severity: Severity;
  url: string;
}

export interface PageReport {
  url: string;
  status: number;
  depth: number;
  score: number;
  issues: Issue[];
}

export interface Summary {
  pages: number;
  errors: number;
  warnings: number;
  infos: number;
}

export interface RuleMeta {
  id: string;
  severity: Severity;
  category: RuleCategory;
  description: string;
  docs: string;
}

export interface Report {
  tool: { name: string; version: string };
  target: string;
  origin: string;
  startedAt: string;
  durationMs: number;
  score: number;
  summary: Summary;
  rules: RuleMeta[];
  pages: PageReport[];
}
