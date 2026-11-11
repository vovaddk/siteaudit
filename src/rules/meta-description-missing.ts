import type { Rule } from '../types.ts';
import { descriptionOf } from './helpers.ts';

export const metaDescriptionMissing: Rule = {
  id: 'meta-description-missing',
  severity: 'warn',
  category: 'seo',
  description: 'Page has a non-empty <meta name="description">.',
  docs: 'Add a 50–160 character summary; search engines often show it as the result snippet.',
  check(page) {
    return descriptionOf(page) === '' ? [{ message: 'Page has no meta description, or it is empty' }] : [];
  },
};
