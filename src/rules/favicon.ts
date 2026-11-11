import type { Rule } from '../types.ts';

export const favicon: Rule = {
  id: 'favicon',
  severity: 'warn',
  category: 'quality',
  description: 'Site has a favicon (<link rel="icon"> or /favicon.ico).',
  docs: 'Add <link rel="icon" href="/favicon.svg">; tabs, bookmarks and search results show it.',
  check(page, site) {
    if (page.$('link[rel~="icon" i]').length > 0) return [];
    const fallback = site.fetched.get(`${site.origin}/favicon.ico`);
    if (fallback !== undefined && fallback.status >= 200 && fallback.status < 300) return [];
    return [{ message: 'No <link rel="icon"> and no /favicon.ico' }];
  },
};
