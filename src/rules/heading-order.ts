import type { Finding, Rule } from '../types.ts';
import { snippet } from './helpers.ts';

export const headingOrder: Rule = {
  id: 'heading-order',
  severity: 'warn',
  category: 'a11y',
  description: 'Heading levels increase by one at a time.',
  docs: 'Do not skip levels (e.g. <h2> straight to <h4>); screen reader users navigate by headings.',
  check(page) {
    const { $ } = page;
    const findings: Finding[] = [];
    let previous: number | undefined;
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const level = Number(el.tagName.slice(1));
      if (previous !== undefined && level > previous + 1) {
        findings.push({
          message: `Heading level skipped: <h${String(previous)}> is followed by <h${String(level)}>`,
          snippet: snippet($, $(el)),
        });
      }
      previous = level;
    });
    return findings;
  },
};
