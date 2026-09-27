// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobPlatform } from '../../jobs/enums/job-platform.enum';
import { parseJobUrl } from '../../jobs/utils/job-url.util';
import { platformOf } from '../../jobs/utils/platform.util';
import { instahyreJobToDiscovered, instahyreSearchPath } from './instahyre.util';

const params = (path: string) => new URLSearchParams(path.split('?')[1]);

describe('Instahyre search', () => {
  it('uses the filters Instahyre verified: skill, job function, repeated city, years', () => {
    const p = params(instahyreSearchPath('nodejs backend developer', 'Noida', 5.4, 0));
    expect(p.getAll('skills')).toEqual(['node.js']);
    expect(p.getAll('job_functions')).toEqual(['10']);
    expect(p.getAll('jobLocations')).toEqual(['Noida']);
    expect(p.get('years')).toBe('5');
    expect(p.get('offset')).toBe('0');
  });

  it('maps remote to Work From Home, skips country-wide locations and pages by 35', () => {
    expect(params(instahyreSearchPath('Full Stack Developer', 'Remote', 3, 2)).getAll('jobLocations')).toEqual(['Work From Home']);
    expect(params(instahyreSearchPath('Full Stack Developer', 'Remote', 3, 2)).getAll('job_functions')).toEqual(['1']);
    expect(params(instahyreSearchPath('Full Stack Developer', 'Remote', 3, 2)).get('offset')).toBe('70');
    expect(params(instahyreSearchPath('React Developer', 'India', 0, 0)).has('jobLocations')).toBe(false);
    expect(params(instahyreSearchPath('React Developer', 'India', 0, 0)).has('years')).toBe(false);
  });

  it('turns a listing into a job labelled Instahyre, with the same id as a pasted link', () => {
    const url = 'https://www.instahyre.com/job-442967-sr-data-scientist-at-quince-bangalore/';
    const job = instahyreJobToDiscovered({
      id: 442967,
      title: 'Sr. Data Scientist',
      locations: 'Bangalore,Work From Home',
      keywords: ['Python', 'LLMs'],
      public_url: url,
      employer: { company_name: 'Quince' },
    })!;
    expect(job).toMatchObject({ title: 'Sr. Data Scientist', company: 'Quince', isRemote: true, skills: ['Python', 'LLMs'] });
    expect(job.externalId).toBe(parseJobUrl(url)!.externalId);
    expect(platformOf(job.source, job.url)).toBe(JobPlatform.INSTAHYRE);
  });
});
