import type { Rule } from '../types.ts';

export const canonicalMissing: Rule = {
  id: 'canonical-missing',
  severity: 'warn',
  category: 'seo',
  description: 'Page declares a <link rel="canonical">.',
  docs: 'Add <link rel="canonical" href="…"> with the preferred URL to avoid splitting ranking across duplicates.',
  check(page) {
    return (page.$('link[rel~="canonical" i]').attr('href') ?? '').trim() === ''
      ? [{ message: 'Page has no canonical URL' }]
      : [];
  },
};
