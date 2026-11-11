import type { Rule } from '../types.ts';
import { titleOf } from './helpers.ts';

const MIN = 10;
const MAX = 60;

export const titleLength: Rule = {
  id: 'title-length',
  severity: 'warn',
  category: 'seo',
  description: `<title> is ${String(MIN)}–${String(MAX)} characters long.`,
  docs: 'Search engines truncate long titles and ignore very short ones. Lead with the key phrase.',
  check(page) {
    const { length } = titleOf(page);
    if (length === 0 || (length >= MIN && length <= MAX)) return [];
    return [
      {
        message: `Title is ${String(length)} characters (recommended ${String(MIN)}–${String(MAX)})`,
        snippet: titleOf(page),
      },
    ];
  },
};
