import type { Rule } from '../types.ts';
import { internalLinks, pathOf } from './helpers.ts';

export const brokenLink: Rule = {
  id: 'broken-link',
  severity: 'error',
  category: 'quality',
  description: 'Internal links resolve without 4xx/5xx or network errors.',
  docs: 'Fix the link target or remove the link; broken links waste crawl budget and frustrate visitors.',
  check(page, site) {
    return internalLinks(page, site.origin).flatMap((link) => {
      const record = site.fetched.get(link);
      if (record === undefined || (record.status > 0 && record.status < 400)) return [];
      const reason = record.status === 0 ? (record.error ?? 'request failed') : `HTTP ${String(record.status)}`;
      return [{ message: `Broken link to ${pathOf(link)} (${reason})` }];
    });
  },
};
