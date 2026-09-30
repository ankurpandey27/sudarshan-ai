// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { RESCUE_SIZES } from '../constants/rescue.constants';
import { FieldKind } from '../enums/field-kind.enum';
import { FormSnapshot } from '../interfaces/form-field.interface';
import { buildRescuePrompt } from './rescue-prompt.util';

const field = (id: string, label: string, value = '', kind = FieldKind.TEXT) => ({
  id,
  kind,
  label,
  name: '',
  placeholder: '',
  required: false,
  value,
  options: [],
  optionIds: [],
  error: '',
  maxLength: null,
  min: null,
  max: null,
  accept: null,
});

const bigPage: FormSnapshot = {
  url: 'https://careers.example.com/apply?token=secret',
  scopeFound: true,
  fields: [field('f1', 'Mobile number', '9876543210'), field('f2', 'PAN', 'ABCDE1234F'), field('f3', 'Notice period', '30 days')],
  actions: Array.from({ length: 70 }, (_, i) => ({ id: `a${i}`, text: `Button number ${i}`, kind: 'other' as const, disabled: false })),
  links: [],
  text: 'Welcome. Contact us at hr@example.com or 9876543210. '.repeat(80),
  errors: [],
  captcha: false,
};

describe('what the rescue AI is shown', () => {
  it('gets shorter at each size, for models with a small limit', () => {
    const lengths = RESCUE_SIZES.map((size) => buildRescuePrompt(bigPage, 'Submit it', [], size).length);
    expect(lengths[1]).toBeLessThan(lengths[0]);
    expect(lengths[2]).toBeLessThan(lengths[1]);
  });

  it('never shows values or text that identify you, nor the address query', () => {
    const p = buildRescuePrompt(bigPage, 'Submit it', [], RESCUE_SIZES[0]);
    expect(p).not.toMatch(/9876543210|ABCDE1234F|hr@example\.com|token=secret/);
    expect(p).toContain('"Mobile number" value=[hidden]');
    // Ordinary answers stay, so the AI knows the form is filled.
    expect(p).toContain('"Notice period" value="30 days"');
  });
});
