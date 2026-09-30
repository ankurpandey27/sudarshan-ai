// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FieldKind } from '../enums/field-kind.enum';
import { cleanRecordAnswer } from './background.util';

describe('questions about your record, for a clean candidate (2026-09-30)', () => {
  it.each([
    ['Is there any legal action against you from anyone?', 'No'],
    ['Have you ever been convicted of a criminal offence?', 'No'],
    ['Do you have any pending court case or FIR?', 'No'],
    ['Have you ever been terminated or dismissed from employment?', 'No'],
    ['Have you been blacklisted by any organisation?', 'No'],
    ['Do you consent to a background verification?', 'Yes'],
    ['Are you willing to undergo police verification?', 'Yes'],
    ['I confirm I have no criminal record', 'Yes'],
    ['Are you free of any pending legal proceedings?', 'Yes'],
  ])('%s -> %s', (q, a) => expect(cleanRecordAnswer(q, FieldKind.RADIO)).toBe(a));

  it('ticks a declaration checkbox and explains in a text box', () => {
    expect(cleanRecordAnswer('I declare that no disciplinary action has been taken against me', FieldKind.CHECKBOX)).toBe('Yes');
    expect(cleanRecordAnswer('If yes, give details of any criminal convictions', FieldKind.TEXTAREA)).toMatch(/^Not applicable/);
  });

  it('leaves other questions alone', () => {
    expect(cleanRecordAnswer('Notice period', FieldKind.TEXT)).toBeNull();
    expect(cleanRecordAnswer('Are you legally authorized to work in India?', FieldKind.RADIO)).toBeNull();
  });
});
