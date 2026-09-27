// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Paginated } from '../../../common/interfaces/paginated.interface';
import { Job } from './job.interface';

export interface JobList extends Paginated<Job> {
  /** Matching jobs per platform, ignoring the platform filter - for filter chips. */
  platforms: Record<string, number>;
}
