// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { DiscoveredJob } from '../../jobs/interfaces/discovered-job.interface';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { JobPlatform } from '../../jobs/enums/job-platform.enum';
import { SearchSettings } from '../../settings/interfaces/app-settings.interface';

export interface SearchQuery {
  keyword: string;
  location: string;
  prefs: SearchSettings;
  /** True for jobs already in the database; only unseen jobs count toward maxPerSearch. */
  isKnown: (externalId: string) => boolean;
  onProgress: (message: string) => void;
}

export interface DiscoverySource {
  readonly source: JobSource;
  /** Which "Apply on" switch turns this search on. */
  readonly platform: JobPlatform;
  search(query: SearchQuery): Promise<DiscoveredJob[]>;
  enrich?(job: DiscoveredJob): Promise<DiscoveredJob>;
  /**
   * All your keywords as one query, for sites whose search understands "any of these words" - one
   * search per location instead of one per keyword and location. Omitted: one search per keyword.
   */
  combine?(keywords: string[]): string;
  /** How many job pages to read at once when fetching full descriptions (default 1). */
  readonly enrichAtOnce?: number;
}

export interface DiscoveryRunResult {
  source: JobSource;
  found: number;
  added: number;
  error?: string;
}
