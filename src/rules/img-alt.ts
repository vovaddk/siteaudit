import type { Rule } from '../types.ts';
import { snippet } from './helpers.ts';

export const imgAlt: Rule = {
  id: 'img-alt',
  severity: 'error',
  category: 'a11y',
  description: 'Every <img> has an alt attribute.',
  docs: 'Describe the image in alt="…", or use alt="" for purely decorative images.',
  check(page) {
    const { $ } = page;
    return $('img:not([alt])')
      .not('[aria-hidden="true"], [role="presentation"], [role="none"]')
      .toArray()
      .map((img) => ({ message: 'Image has no alt attribute', snippet: snippet($, $(img)) }));
  },
};
