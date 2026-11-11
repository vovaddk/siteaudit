import type { Rule } from '../types.ts';
import { titleOf } from './helpers.ts';

export const titleMissing: Rule = {
  id: 'title-missing',
  severity: 'error',
  category: 'seo',
  description: 'Page has a non-empty <title>.',
  docs: 'Add a descriptive <title> inside <head>; it is the headline in search results and browser tabs.',
  check(page) {
    return titleOf(page) === '' ? [{ message: 'Page has no <title>, or it is empty' }] : [];
  },
};
