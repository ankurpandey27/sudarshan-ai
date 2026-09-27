// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface JobStats {
  byStatus: Record<string, number>;
  appliedToday: number;
  appliedTodayBySource: Record<string, number>;
  /** Keyed by JobPlatform. */
  appliedTodayByPlatform: Record<string, number>;
  queuedByPlatform: Record<string, number>;
  appliedTotal: number;
  /** Over the last 50 successful applications. */
  medianApplySeconds: number | null;
  /** Share of fields filled without the AI, over the same window. */
  memoryHitRate: number | null;
}
