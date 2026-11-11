import type { Rule } from '../types.ts';
import { accessibleName, snippet } from './helpers.ts';

export const buttonName: Rule = {
  id: 'button-name',
  severity: 'error',
  category: 'a11y',
  description: 'Every button has an accessible name.',
  docs: 'Give icon-only buttons visible text or an aria-label.',
  check(page) {
    const { $ } = page;
    return $('button, [role="button"], input[type="button" i]')
      .not('[aria-hidden="true"]')
      .toArray()
      .filter((button) => accessibleName($, $(button)) === '')
      .map((button) => ({ message: 'Button has no accessible name', snippet: snippet($, $(button)) }));
  },
};
