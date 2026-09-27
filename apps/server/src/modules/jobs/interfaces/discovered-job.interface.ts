// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobSource } from '../enums/job-source.enum';

export interface DiscoveredJob {
  source: JobSource;
  externalId: string;
  url: string;
  applyUrl?: string | null;
  title: string;
  company: string;
  location: string;
  isRemote: boolean;
  easyApply: boolean;
  salaryRaw?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  description: string;
  skills?: string[];
  postedAt?: string | null;
}
