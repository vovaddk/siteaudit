import type { Rule } from '../types.ts';

export const htmlLang: Rule = {
  id: 'html-lang',
  severity: 'error',
  category: 'a11y',
  description: '<html> has a lang attribute.',
  docs: 'Add e.g. <html lang="en"> so screen readers pick the right pronunciation.',
  check(page) {
    return (page.$('html').attr('lang') ?? '').trim() === ''
      ? [{ message: '<html> element has no lang attribute' }]
      : [];
  },
};
