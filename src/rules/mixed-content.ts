import { isTag } from 'domhandler';
import type { Rule } from '../types.ts';
import { snippet } from './helpers.ts';

const SUBRESOURCES: [selector: string, attribute: string][] = [
  ['img, script, iframe, audio, video, source, embed, track', 'src'],
  ['img, source', 'srcset'],
  ['object', 'data'],
  ['link[rel~="stylesheet" i], link[rel~="icon" i], link[rel~="preload" i]', 'href'],
];

export const mixedContent: Rule = {
  id: 'mixed-content',
  severity: 'error',
  category: 'quality',
  description: 'HTTPS pages load no subresources over plain HTTP.',
  docs: 'Serve every script, style, image and frame over https://; browsers block or flag mixed content.',
  check(page) {
    if (!page.url.startsWith('https:')) return [];
    const { $ } = page;
    return SUBRESOURCES.flatMap(([selector, attribute]) =>
      $(selector)
        .toArray()
        .filter(isTag)
        .filter((el) => /(^|[\s,])http:\/\//i.test($(el).attr(attribute) ?? ''))
        .map((el) => ({ message: `Insecure <${el.tagName}> loaded over http://`, snippet: snippet($, $(el)) })),
    );
  },
};
