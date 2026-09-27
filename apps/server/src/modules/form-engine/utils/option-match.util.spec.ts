// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { inRange, isPlaceholderOption, matchOption } from './option-match.util';

describe('matchOption', () => {
  const years = ['Select an option', 'Fresher', '1-2 years', '3-5 years', '5+ years'];

  it('maps numbers onto range options', () => {
    expect(matchOption('4', years)).toBe(3);
    expect(matchOption('7', years)).toBe(4);
    expect(matchOption('0', years)).toBe(1);
  });

  it('maps yes / no synonyms', () => {
    expect(matchOption('true', ['Yes', 'No'])).toBe(0);
    expect(matchOption('no', ['Yes, I am', 'No, I am not'])).toBe(1);
  });

  it('maps phone codes onto country options', () => {
    expect(matchOption('+91', ['United States (+1)', 'India (+91)'])).toBe(1);
  });

  it('never picks a placeholder', () => {
    expect(matchOption('select', ['Select an option', 'A'])).toBe(-1);
    expect(isPlaceholderOption('-- Select --')).toBe(true);
    expect(isPlaceholderOption('Selenium')).toBe(false);
    expect(isPlaceholderOption('Select an option')).toBe(true);
  });

  it('understands open-ended ranges', () => {
    expect(inRange(15, '15 days or less')).toBe(true);
    expect(inRange(30, '15 days or less')).toBe(false);
    expect(inRange(11, 'More than 10 years')).toBe(true);
    expect(inRange(10, 'More than 10 years')).toBe(false);
  });

  it('does not read words that start with "no" as No', () => {
    for (const v of ['Noida', 'November 2026', 'Not sure', 'Norway']) expect(matchOption(v, ['Yes', 'No'])).toBe(-1);
    expect(matchOption('Nope', ['Yes', 'No'])).toBe(1);
    expect(matchOption('Noida', ['Delhi', 'Noida', 'Gurgaon'])).toBe(1);
    expect(matchOption('New Delhi', ['Mumbai', 'New Delhi, India'])).toBe(1);
  });
});
