// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { jobSourceAnswer } from './job-source.util';

describe('"How did you hear about this job?" (2026-10-01)', () => {
  const list = ['Select an option', 'Company website', 'Indeed', 'LinkedIn', 'Naukri.com', 'Referral', 'Other'];

  it('names the board the job was really found on', () => {
    expect(jobSourceAnswer('Indeed', list)).toBe('Indeed');
    expect(jobSourceAnswer('LinkedIn', list)).toBe('LinkedIn');
    expect(jobSourceAnswer('Naukri', list)).toBe('Naukri.com');
    // A link you added from a company's careers page.
    expect(jobSourceAnswer('Company website', list)).toBe('Company website');
  });

  it("picks the closest honest choice when the board is not listed, and 'Other' only last", () => {
    expect(jobSourceAnswer('Indeed', ['Employee referral', 'Job Boards (Indeed, Monster, etc.)', 'Social media', 'Other'])).toBe(
      'Job Boards (Indeed, Monster, etc.)',
    );
    expect(jobSourceAnswer('Instahyre', ['Referral', 'Online job portal', 'Campus', 'Other'])).toBe('Online job portal');
    expect(jobSourceAnswer('LinkedIn', ['Referral', 'Career fair', 'Other'])).toBe('Other');
    expect(jobSourceAnswer('Company website', ['Referral', 'Our careers page', 'Job board'])).toBe('Our careers page');
  });

  it('never claims a referral, and says nothing when no choice fits', () => {
    expect(jobSourceAnswer('Indeed', ['Referral', 'Career fair'])).toBeNull();
  });

  it('names the source in a text box', () => {
    expect(jobSourceAnswer('Naukri', [])).toBe('Naukri');
  });
});
