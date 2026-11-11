import type { Report } from '../types.ts';

/** Path for same-origin URLs, full URL otherwise. */
export function displayUrl(url: string, origin: string): string {
  const parsed = new URL(url);
  return parsed.origin === origin ? parsed.pathname + parsed.search : url;
}

/** Host for URL targets; the folder path for local audits (served from a random 127.0.0.1 port). */
export function siteName(report: Report): string {
  return /^https?:\/\//i.test(report.target) ? new URL(report.origin).host : report.target;
}
