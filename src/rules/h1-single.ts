import type { Rule } from '../types.ts';
import { snippet } from './helpers.ts';

export const h1Single: Rule = {
  id: 'h1-single',
  severity: 'warn',
  category: 'seo',
  description: 'Page has exactly one <h1>.',
  docs: 'Use one <h1> for the main topic of the page and <h2>–<h6> for sections.',
  check(page) {
    const h1 = page.$('h1');
    if (h1.length === 1) return [];
    if (h1.length === 0) return [{ message: 'Page has no <h1>' }];
    return [{ message: `Page has ${String(h1.length)} <h1> elements`, snippet: snippet(page.$, h1.eq(1)) }];
  },
};
