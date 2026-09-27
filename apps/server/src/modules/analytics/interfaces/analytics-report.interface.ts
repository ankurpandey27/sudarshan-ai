// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobPlatform } from '../../jobs/enums/job-platform.enum';

export interface AnalyticsDay {
  /** Local date, YYYY-MM-DD. */
  day: string;
  found: number;
  applied: Partial<Record<JobPlatform, number>>;
}

export interface AnalyticsPeriod {
  found: number;
  applied: number;
}

export interface AnalyticsReport {
  days: number;
  platform: JobPlatform | null;
  daily: AnalyticsDay[];
  current: AnalyticsPeriod;
  /** The same length of time just before, for trends. */
  previous: AnalyticsPeriod;
  /** Jobs found in the range and how far they got. */
  pipeline: { found: number; scored: number; matched: number; approved: number; applied: number };
  byPlatform: { platform: JobPlatform; found: number; applied: number }[];
  /** Match scores in steps of 10: bucket 0 is 0-9, bucket 9 is 90-100. */
  scores: { bucket: number; jobs: number; applied: number }[];
  /** `fix` says which setting to change. */
  skipReasons: { rule: string; label: string; fix: string; jobs: number }[];
  missingSkills: { skill: string; jobs: number }[];
}
