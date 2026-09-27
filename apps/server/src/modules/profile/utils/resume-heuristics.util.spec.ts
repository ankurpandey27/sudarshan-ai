// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pdfToText } from './pdf-text.util';
import { parseResumeHeuristically, yearsFromDateRanges } from './resume-heuristics.util';

describe('resume parsing without an LLM', () => {
  it('reads contact details, title, city, links, years and skills from a real PDF', async () => {
    const text = await pdfToText(readFileSync(join(__dirname, '../../../../test/fixtures/sample-resume.pdf')));
    const p = parseResumeHeuristically(text, new Date('2026-09-26'));
    expect(p).toMatchObject({
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya.sharma@example.com',
      phone: '9876543210',
      phoneCountryCode: '+91',
      currentTitle: 'Senior Backend Engineer',
      city: 'Pune',
      linkedinUrl: 'https://linkedin.com/in/example-priya-sharma',
      githubUrl: 'https://github.com/example-priya-sharma',
      totalYearsExperience: 5,
    });
    expect(p.skills?.map((s) => s.name)).toEqual(expect.arrayContaining(['node.js', 'typescript', 'postgresql', 'kafka']));
  });

  it('computes experience from date ranges, counting overlaps once', () => {
    const text = 'Experience\nAcme Jan 2020 - Dec 2021\nBeta Jun 2021 - Present\nEducation\nB.Tech 2015 - 2019';
    expect(yearsFromDateRanges(text, new Date('2026-06-15'))).toBeCloseTo(6.5, 0);
  });
});
