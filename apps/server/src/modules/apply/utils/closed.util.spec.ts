// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FormAction } from '../../form-engine/interfaces/form-field.interface';
import { looksClosed } from './closed.util';

const action = (text: string, kind: FormAction['kind'], disabled = false): FormAction => ({ id: text, text, kind, disabled });

describe('telling a closed job from an open one', () => {
  it('a "Job expired?" link above a working Apply now is an open job (Himalayas, Nagarro, 2026-10-03)', () => {
    const text = 'Engineer, NodeJS\nApply now\nJob expired?\nPlease let Nagarro know you found this job on Himalayas.';
    expect(looksClosed(text, { actions: [action('Apply now', 'apply')] })).toBe(false);
    // Even with no button read yet, a question is not a statement.
    expect(looksClosed(text, { actions: [] })).toBe(false);
  });

  it('wording about expired jobs elsewhere on the page does not close a job that offers Apply', () => {
    expect(looksClosed('Senior Developer. Apply. FAQ: what happens when a job has expired', { actions: [action('Apply', 'apply')] })).toBe(false);
  });

  it('still knows a closed job: the words, and no Apply - or only a greyed-out one, or one for other jobs', () => {
    const text = 'Backend Engineer at Acme. No longer accepting applications.';
    expect(looksClosed(text, { actions: [] })).toBe(true);
    expect(looksClosed(text, { actions: [action('Apply', 'apply', true)] })).toBe(true);
    expect(looksClosed(text, { actions: [action('Apply to similar jobs', 'apply')] })).toBe(true);
    expect(looksClosed('This job has expired', { actions: [action('Save', 'other')] })).toBe(true);
  });

  it("uses a site's own closed wording too (Indeed)", () => {
    expect(looksClosed('This job has been removed from Indeed', { actions: [] }, /removed from indeed/i)).toBe(true);
  });
});
