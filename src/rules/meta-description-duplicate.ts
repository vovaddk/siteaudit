import type { Rule } from '../types.ts';
import { descriptionOf, pathOf } from './helpers.ts';

export const metaDescriptionDuplicate: Rule = {
  id: 'meta-description-duplicate',
  severity: 'warn',
  category: 'seo',
  description: 'Meta description is unique across the crawled pages.',
  docs: 'Write a specific description for every page instead of reusing a site-wide one.',
  check(page, site) {
    const description = descriptionOf(page);
    if (description === '') return [];
    const others = site.pages.filter((other) => other !== page && descriptionOf(other) === description);
    if (others.length === 0) return [];
    return [
      {
        message: `Meta description is also used by ${String(others.length)} other page(s)`,
        snippet: others.map((other) => pathOf(other.url)).join(', '),
      },
    ];
  },
};
