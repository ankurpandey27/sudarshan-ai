// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobSource } from '../../jobs/enums/job-source.enum';
import { DiscoveredJob } from '../../jobs/interfaces/discovered-job.interface';
import { parseJobUrl } from '../../jobs/utils/job-url.util';
import { INSTAHYRE_JOB_FUNCTIONS, INSTAHYRE_PAGE_SIZE, INSTAHYRE_SEARCH_API } from '../constants/platform.constants';
import { InstahyreJob } from '../interfaces/instahyre-api.interface';
import { extractSkills } from './job-normalizer.util';

/** Search URL for one keyword and location, e.g. "nodejs backend developer" in Noida with 5 years. */
export function instahyreSearchPath(keyword: string, location: string, years: number, page: number): string {
  const q = new URLSearchParams();
  // One skill: several skills together were not verified to combine.
  const skill = extractSkills(keyword)[0];
  if (skill) q.append('skills', skill);
  for (const f of INSTAHYRE_JOB_FUNCTIONS) if (f.match.test(keyword)) q.append('job_functions', String(f.id));
  const place = /^(remote|work from home|wfh)$/i.test(location.trim()) ? 'Work From Home' : location.trim();
  // A whole country is not a city filter.
  if (place && !/^india$/i.test(place)) q.append('jobLocations', place);
  if (years > 0) q.append('years', String(Math.floor(years)));
  q.append('limit', String(INSTAHYRE_PAGE_SIZE));
  q.append('offset', String(page * INSTAHYRE_PAGE_SIZE));
  return `${INSTAHYRE_SEARCH_API}?${q}`;
}

export function instahyreJobToDiscovered(j: InstahyreJob): DiscoveredJob | null {
  if (!j.public_url || !j.title) return null;
  // Same identity as a pasted Instahyre link, so the two never duplicate.
  const parsed = parseJobUrl(j.public_url);
  if (!parsed) return null;
  return {
    source: JobSource.WEB,
    externalId: parsed.externalId,
    url: parsed.url,
    title: j.title,
    company: j.employer?.company_name ?? '',
    location: j.locations ?? '',
    isRemote: /work from home|remote/i.test(j.locations ?? ''),
    easyApply: false,
    description: (j.keywords ?? []).join(', '),
    skills: j.keywords ?? [],
  };
}
