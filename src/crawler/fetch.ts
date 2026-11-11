import type { FetchRecord } from '../types.ts';

const MAX_REDIRECTS = 10;

export interface FetchOptions {
  method: 'GET' | 'HEAD';
  timeoutMs: number;
  userAgent: string;
}

interface FetchResult {
  record: FetchRecord;
  headers: Record<string, string>;
  /** Response body; only read for successful GET requests of text content. */
  body?: string;
}

/** Fetches `url`, following redirects by hand so the full chain is recorded. Never throws. */
export async function fetchUrl(url: string, options: FetchOptions): Promise<FetchResult> {
  const record: FetchRecord = { url, finalUrl: url, status: 0, redirects: [] };
  let current = url;
  let method = options.method;
  try {
    for (let hop = 0; ; hop++) {
      const response = await fetch(current, {
        method,
        redirect: 'manual',
        headers: { 'user-agent': options.userAgent, accept: 'text/html,*/*;q=0.8' },
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location !== null) {
        await response.body?.cancel();
        if (hop === MAX_REDIRECTS) {
          return { record: { ...record, error: `More than ${String(MAX_REDIRECTS)} redirects` }, headers: {} };
        }
        record.redirects.push(current);
        current = new URL(location, current).href;
        continue;
      }
      // Some servers reject HEAD; retry the same URL with GET.
      if (method === 'HEAD' && (response.status === 405 || response.status === 501)) {
        await response.body?.cancel();
        method = 'GET';
        continue;
      }
      record.finalUrl = current;
      record.status = response.status;
      const contentType = response.headers.get('content-type');
      if (contentType !== null) record.contentType = contentType;
      const length = Number(response.headers.get('content-length') ?? Number.NaN);
      if (Number.isFinite(length)) record.contentLength = length;
      const headers = Object.fromEntries(response.headers);
      const isText = contentType === null || /text|html|xml/i.test(contentType);
      if (method === 'GET' && response.ok && isText) {
        return { record, headers, body: await response.text() };
      }
      await response.body?.cancel();
      return { record, headers };
    }
  } catch (error) {
    record.finalUrl = current;
    // undici reports "fetch failed" and keeps the useful reason (ECONNREFUSED, ...) in `cause`.
    const cause = error instanceof Error ? error.cause : undefined;
    record.error = cause instanceof Error ? cause.message : error instanceof Error ? error.message : String(error);
    return { record, headers: {} };
  }
}
