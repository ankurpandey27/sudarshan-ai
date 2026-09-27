// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** A scoring run in progress, for the progress bar. */
export interface ScoringProgress {
  total: number;
  done: number;
  /** rules: quick checks and the rule engine; ai: asking the AI model; saving: writing results. */
  stage: 'rules' | 'ai' | 'saving';
  /** Jobs skipped so far by a hard rule (location, salary...). */
  skipped: number;
  startedAt: string;
  /** Rough seconds left, from the pace so far; null until there is a pace. */
  etaSeconds: number | null;
}
