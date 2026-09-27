// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

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
  return [hostOf(url), hostOf(applyUrl)].some((h) => h === 'instahyre.com' || h.endsWith('.instahyre.com'))
    ? JobPlatform.INSTAHYRE
    : JobPlatform.OTHER;
}

/** The site a job lives on, e.g. "jobs.lever.co". */
export const siteOf = (url: string): string => hostOf(url);
