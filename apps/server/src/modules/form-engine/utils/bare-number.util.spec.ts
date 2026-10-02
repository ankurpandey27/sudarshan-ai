// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { bareNumber, FORMAT_ERROR } from './bare-number.util';

describe('the number in an answer, for a numbers-only box', () => {
  it.each([
    ['30 days', '30'],
    ['12 LPA', '12'],
    ['5+ years', '5'],
    ['2.5 years', '2.5'],
  ])('%s -> %s', (answer, n) => expect(bareNumber(answer)).toBe(n));

  it.each(['30', 'Immediate', 'Yes', ''])('nothing different to try for "%s"', (answer) => expect(bareNumber(answer)).toBeNull());

  it('knows a format error from a missing answer', () => {
    expect(FORMAT_ERROR.test('Invalid input')).toBe(true);
    expect(FORMAT_ERROR.test('Enter a whole number between 0 and 99')).toBe(true);
    expect(FORMAT_ERROR.test('Please enter a valid answer')).toBe(false);
    expect(FORMAT_ERROR.test('This field is required')).toBe(false);
  });
});
