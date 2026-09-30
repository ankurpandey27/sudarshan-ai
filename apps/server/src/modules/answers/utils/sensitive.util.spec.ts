// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { isSensitive, redactSensitive } from './sensitive.util';

describe('what never reaches the AI', () => {
  it.each([
    ['What is my PAN number?', 'ABCDE1234F'],
    ['Aadhaar number', '1234 5678 9012'],
    ['Date of Birth', '15/03/1995'],
    ['Mobile number', '9876543210'],
    ['Email', 'priya@example.com'],
    ['Current address', 'Sector 62, Noida'],
    // Any question, but the answer is an identifier.
    ['Reference', 'ABCDE1234F'],
    ['Contact', '+91 98765 43210'],
  ])('%s: %s', (q, a) => expect(isSensitive(q, a)).toBe(true));

  it.each([
    ['What is your notice period?', '30 days'],
    ['Expected CTC (LPA)', '18'],
    ['Why do you want this job?', 'I build Node.js systems'],
    ['Years of Node.js experience', '5'],
  ])('shows ordinary answers: %s', (q, a) => expect(isSensitive(q, a)).toBe(false));

  it('blanks identifiers in page text, keeps the rest', () => {
    expect(redactSensitive('Review: Priya, priya@example.com, 9876543210, PAN ABCDE1234F, notice 30 days')).toBe(
      'Review: Priya, [hidden], [hidden], PAN [hidden], notice 30 days',
    );
  });
});
