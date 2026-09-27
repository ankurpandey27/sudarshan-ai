// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobSource } from '../enums/job-source.enum';

export interface ParsedJobUrl {
  source: JobSource;
  externalId: string;
  url: string;
}
