// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface LlmJobScore {
  id: number;
  score: number;
  summary?: string;
  matched?: string[];
  missing?: string[];
}

export interface ScoringRunResult {
  scored: number;
  review: number;
  queued: number;
  skipped: number;
  llmCalls: number;
  skippedBy: Record<string, number>;
}

export interface LastScoringRun extends ScoringRunResult {
  total: number;
  at: string;
}
