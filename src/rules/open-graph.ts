import type { Rule } from '../types.ts';

const REQUIRED = ['og:title', 'og:description', 'og:image'];

export const openGraph: Rule = {
  id: 'open-graph',
  severity: 'warn',
  category: 'seo',
  description: 'Page has og:title, og:description and og:image.',
  docs: 'Open Graph tags control the preview card when the page is shared on social networks and in chat apps.',
  check(page) {
    const missing = REQUIRED.filter(
      (property) => (page.$(`meta[property="${property}"]`).attr('content') ?? '').trim() === '',
    );
    return missing.length === 0 ? [] : [{ message: `Missing Open Graph tags: ${missing.join(', ')}` }];
  },
};
