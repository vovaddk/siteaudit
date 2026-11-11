import type { Rule } from '../types.ts';
import { snippet } from './helpers.ts';

export const renderBlockingScript: Rule = {
  id: 'render-blocking-script',
  severity: 'warn',
  category: 'quality',
  description: 'External scripts in <head> use defer, async or type="module".',
  docs: 'Add defer (keeps execution order) or async, or move the script to the end of <body>.',
  check(page) {
    const { $ } = page;
    return $('head script[src]')
      .not('[defer], [async], [type="module" i]')
      .toArray()
      .map((script) => ({ message: 'Render-blocking script in <head>', snippet: snippet($, $(script)) }));
  },
};
