import type { Rule } from '../types.ts';
import { internalLinks, pathOf } from './helpers.ts';

export const redirectChain: Rule = {
  id: 'redirect-chain',
  severity: 'warn',
  category: 'quality',
  description: 'Internal links go through at most one redirect.',
  docs: 'Link straight to the final URL; every extra hop adds latency and dilutes link signals.',
  check(page, site) {
    return internalLinks(page, site.origin).flatMap((link) => {
      const record = site.fetched.get(link);
      if (record === undefined || record.redirects.length < 2) return [];
      return [
        {
          message: `Link to ${pathOf(link)} redirects ${String(record.redirects.length)} times`,
          snippet: [...record.redirects, record.finalUrl].map(pathOf).join(' → '),
        },
      ];
    });
  },
};
