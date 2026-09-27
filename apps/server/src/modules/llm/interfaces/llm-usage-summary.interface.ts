// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { LlmUsagePeriod } from './llm-usage-period.interface';

export interface LlmUsageSummary {
  day: string;
  /** Daily token budget for paid models; 0 = no limit. */
  budget: number;
  today: LlmUsagePeriod;
  month: LlmUsagePeriod;
  allTime: LlmUsagePeriod & { since: string | null };
  /** Today's calls by purpose. */
  byPurpose: { purpose: string; calls: number; tokens: number }[];
  /** All-time totals by purpose and by model. */
  byPurposeAllTime: { purpose: string; calls: number; tokens: number }[];
  byModel: { model: string; calls: number; tokens: number }[];
}
