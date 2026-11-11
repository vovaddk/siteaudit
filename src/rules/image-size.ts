import type { Rule } from '../types.ts';
import { pathOf } from './helpers.ts';

const MAX_BYTES = 200 * 1024;
const kb = (bytes: number): string => `${String(Math.round(bytes / 1024))} KB`;

export const imageSize: Rule = {
  id: 'image-size',
  severity: 'warn',
  category: 'quality',
  description: `Images are at most ${kb(MAX_BYTES)} (by Content-Length).`,
  docs: 'Compress the image, serve AVIF/WebP and size it to its display dimensions.',
  check(page, site) {
    return [...new Set(page.images)].flatMap((image) => {
      const size = site.fetched.get(image)?.contentLength;
      if (size === undefined || size <= MAX_BYTES) return [];
      const name = new URL(image).origin === site.origin ? pathOf(image) : image;
      return [{ message: `Image ${name} is ${kb(size)} (limit ${kb(MAX_BYTES)})` }];
    });
  },
};
