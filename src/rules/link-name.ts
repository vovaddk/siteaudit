import type { Rule } from '../types.ts';
import { accessibleName, snippet } from './helpers.ts';

export const linkName: Rule = {
  id: 'link-name',
  severity: 'error',
  category: 'a11y',
  description: 'Every link has an accessible name.',
  docs: 'Give icon-only links text, an aria-label, or an <img> with alt text.',
  check(page) {
    const { $ } = page;
    return $('a[href]')
      .not('[aria-hidden="true"]')
      .toArray()
      .filter((link) => accessibleName($, $(link)) === '')
      .map((link) => ({ message: 'Link has no accessible name', snippet: snippet($, $(link)) }));
  },
};
