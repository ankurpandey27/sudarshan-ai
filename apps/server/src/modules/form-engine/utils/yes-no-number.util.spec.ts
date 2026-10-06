// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { yesNoAsNumber } from './yes-no-number.util';

describe('a yes/no answer in a numbers-only box (LinkedIn, 2026-10-06)', () => {
  const question = "We must fill this position urgently. Can you start immediately within 30 days' notice?";

  it('a question about starting or notice gets your notice period in days', () => {
    expect(yesNoAsNumber(question, 'Yes', 30)).toBe('30');
    expect(yesNoAsNumber(question, 'Yes', 15)).toBe('15');
    expect(yesNoAsNumber('What is your notice period?', 'No', 60)).toBe('60');
  });

  it('without a notice period, "Yes" to a question naming one number is that number', () => {
    expect(yesNoAsNumber(question, 'Yes', null)).toBe('30');
    expect(yesNoAsNumber('Are you comfortable working 5 days a week from the office?', 'Yes', null)).toBe('5');
  });

  it('otherwise Yes is 1 and No is 0', () => {
    expect(yesNoAsNumber('Are you willing to relocate?', 'Yes', 30)).toBe('1');
    expect(yesNoAsNumber('Do you have a valid passport?', 'No', 30)).toBe('0');
    expect(yesNoAsNumber('Between 3 and 5 years of Java?', 'Yes', null)).toBe('1');
  });

  it('leaves answers that are not yes or no alone', () => {
    expect(yesNoAsNumber(question, '30 days', 30)).toBeNull();
    expect(yesNoAsNumber(question, 'I can join next month', 30)).toBeNull();
  });
});
