// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobPlatform } from '../enums/job-platform.enum';

// Same rule as platformOf(), for filtering and counting in SQL.
export const PLATFORM_SQL = `(CASE
  WHEN source <> 'web' THEN source
  WHEN url LIKE '%instahyre.com/%' OR apply_url LIKE '%instahyre.com/%' THEN '${JobPlatform.INSTAHYRE}'
  WHEN url LIKE '%foundit.in/%' THEN '${JobPlatform.FOUNDIT}'
  WHEN url LIKE '%hirist.tech/%' OR url LIKE '%hirist.com/%' THEN '${JobPlatform.HIRIST}'
  WHEN url LIKE '%himalayas.app/%' THEN '${JobPlatform.HIMALAYAS}'
  ELSE '${JobPlatform.OTHER}' END)`;

export const PLATFORM_LABEL: Record<JobPlatform, string> = {
  [JobPlatform.LINKEDIN]: 'LinkedIn',
  [JobPlatform.NAUKRI]: 'Naukri',
  [JobPlatform.INDEED]: 'Indeed',
  [JobPlatform.INSTAHYRE]: 'Instahyre',
  [JobPlatform.FOUNDIT]: 'Foundit',
  [JobPlatform.HIRIST]: 'Hirist',
  [JobPlatform.HIMALAYAS]: 'Himalayas',
  [JobPlatform.OTHER]: 'Other sites',
};
