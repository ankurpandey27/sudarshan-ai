// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { PLATFORM_LABEL } from '../constants/job-platform.constants';
import { JobPlatform } from '../enums/job-platform.enum';

/** Human name of a job source or platform. */
export const sourceLabel = (source: string): string =>
  PLATFORM_LABEL[source as JobPlatform] ?? ({ web: 'Other sites' } as Record<string, string>)[source] ?? source;
