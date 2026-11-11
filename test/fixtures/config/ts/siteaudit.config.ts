import { defineConfig } from '../../../../src/config/config.ts';
import type { Rule } from '../../../../src/types.ts';

const noLoremIpsum: Rule = {
  id: 'no-lorem-ipsum',
  severity: 'error',
  category: 'quality',
  description: 'Page contains no placeholder copy.',
  docs: 'Replace "Lorem ipsum" with real content before launch.',
  check(page) {
    return /lorem ipsum/i.test(page.$('body').text()) ? [{ message: 'Placeholder text "Lorem ipsum" found' }] : [];
  },
};

export default defineConfig({
  failOn: 'warn',
  customRules: [noLoremIpsum],
});
