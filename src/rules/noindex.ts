import type { Rule } from '../types.ts';

export const noindex: Rule = {
  id: 'noindex',
  severity: 'warn',
  category: 'seo',
  description: 'Page is indexable (no "noindex" in meta robots or X-Robots-Tag).',
  docs: 'Remove noindex before launch; it is often left over from a staging environment.',
  check(page) {
    const { $ } = page;
    const meta = $('meta[name="robots" i], meta[name="googlebot" i]')
      .map((_, el) => $(el).attr('content'))
      .get()
      .join(', ');
    if (/noindex/i.test(meta)) {
      return [{ message: 'Page is excluded from search by <meta name="robots">', snippet: meta }];
    }
    const header = page.headers['x-robots-tag'] ?? '';
    if (/noindex/i.test(header)) {
      return [{ message: 'Page is excluded from search by the X-Robots-Tag header', snippet: header }];
    }
    return [];
  },
};
