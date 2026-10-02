// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { SiteId } from '../../browser/interfaces/site-session.interface';
import { JobPlatform } from '../../jobs/enums/job-platform.enum';

/** The login each job board's applications depend on. */
export const SITE_OF_PLATFORM: Partial<Record<JobPlatform, SiteId>> = {
  [JobPlatform.LINKEDIN]: 'linkedin',
  [JobPlatform.NAUKRI]: 'naukri',
  [JobPlatform.INDEED]: 'indeed',
  [JobPlatform.INSTAHYRE]: 'instahyre',
  [JobPlatform.FOUNDIT]: 'foundit',
  [JobPlatform.HIRIST]: 'hirist',
};
