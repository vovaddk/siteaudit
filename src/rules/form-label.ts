import type { Rule } from '../types.ts';
import { snippet } from './helpers.ts';

/** Input types that are labelled by their value or need no label. */
const SELF_LABELLED = new Set(['hidden', 'submit', 'reset', 'button', 'image']);
const NAMING_ATTRIBUTES = ['aria-label', 'aria-labelledby', 'title'];

export const formLabel: Rule = {
  id: 'form-label',
  severity: 'error',
  category: 'a11y',
  description: 'Every form control has a label.',
  docs: 'Wrap the control in <label>, point <label for="id"> at it, or add aria-label. A placeholder is not a label.',
  check(page) {
    const { $ } = page;
    const labelled = new Set($('label[for]').map((_, label) => $(label).attr('for')).get());
    return $('input, select, textarea')
      .toArray()
      .filter((el) => {
        const control = $(el);
        if (SELF_LABELLED.has((control.attr('type') ?? '').toLowerCase())) return false;
        const id = control.attr('id');
        if (id !== undefined && labelled.has(id)) return false;
        if (NAMING_ATTRIBUTES.some((attribute) => (control.attr(attribute) ?? '').trim() !== '')) return false;
        return control.closest('label').length === 0;
      })
      .map((el) => ({ message: 'Form control has no label', snippet: snippet($, $(el)) }));
  },
};
