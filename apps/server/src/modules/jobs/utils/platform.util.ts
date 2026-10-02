// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { isHostOf } from './host.util';
import { JobSource } from '../enums/job-source.enum';
import { JobPlatform } from '../enums/job-platform.enum';

const hostOf = (url: string | null): string => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '').toLowerCase() : '';
  } catch {
    return '';
  }
};

export function platformOf(source: JobSource, url: string, applyUrl: string | null = null): JobPlatform {
  if (source === JobSource.LINKEDIN) return JobPlatform.LINKEDIN;
  if (source === JobSource.NAUKRI) return JobPlatform.NAUKRI;
  if (source === JobSource.INDEED) return JobPlatform.INDEED;
  if ([hostOf(url), hostOf(applyUrl)].some((h) => isHostOf(h, 'instahyre.com'))) return JobPlatform.INSTAHYRE;
  // Foundit and Hirist by the job's own page: a listing that sends you to a company site is that site's job.
  if (isHostOf(hostOf(url), 'foundit.in')) return JobPlatform.FOUNDIT;
  if (isHostOf(hostOf(url), 'hirist.tech') || isHostOf(hostOf(url), 'hirist.com')) return JobPlatform.HIRIST;
  return JobPlatform.OTHER;
}

/** The site a job lives on, e.g. "jobs.lever.co". */
export const siteOf = (url: string): string => hostOf(url);
