import type { Rule } from '../types.ts';
import { pathOf, titleOf } from './helpers.ts';

export const titleDuplicate: Rule = {
  id: 'title-duplicate',
  severity: 'warn',
  category: 'seo',
  description: '<title> is unique across the crawled pages.',
  docs: 'Give every page its own title so search engines can tell them apart.',
  check(page, site) {
    const title = titleOf(page);
    if (title === '') return [];
    const others = site.pages.filter((other) => other !== page && titleOf(other) === title);
    if (others.length === 0) return [];
    return [
      {
        message: `Title "${title}" is also used by ${String(others.length)} other page(s)`,
        snippet: others.map((other) => pathOf(other.url)).join(', '),
      },
    ];
  },
};
