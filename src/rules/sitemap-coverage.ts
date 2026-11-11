import type { Rule } from '../types.ts';

export const sitemapCoverage: Rule = {
  id: 'sitemap-coverage',
  severity: 'info',
  category: 'seo',
  description: 'Page is listed in sitemap.xml (checked only when the site has a sitemap).',
  docs: 'Add the page to sitemap.xml, or make sure leaving it out is intentional.',
  check(page, site) {
    if (site.sitemap === undefined || site.sitemap.has(page.url)) return [];
    return [{ message: 'Page is reachable by links but not listed in sitemap.xml' }];
  },
};
