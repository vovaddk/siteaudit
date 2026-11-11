import type { Rule } from '../types.ts';

export const viewport: Rule = {
  id: 'viewport',
  severity: 'error',
  category: 'seo',
  description: 'Page has a responsive <meta name="viewport">.',
  docs: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to <head>.',
  check(page) {
    const content = page.$('meta[name="viewport" i]').attr('content') ?? '';
    return /width\s*=/i.test(content) ? [] : [{ message: 'Page has no responsive viewport meta tag' }];
  },
};
