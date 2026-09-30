// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface AttemptStats {
  steps: number;
  fields: number;
  llmCalls: number;
  memoryHits: number;
}

export interface Attempt extends AttemptStats {
  id: number;
  jobId: number;
  startedAt: string;
  finishedAt: string | null;
  outcome: string | null;
  detail: string | null;
  durationMs: number | null;
  screenshot: string | null;
  trace: string[];
  /** The page at each step (file names in the screenshots folder), oldest first. */
  shots: AttemptShot[];
}

export interface AttemptShot {
  label: string;
  file: string;
  at: string;
}

export interface AttemptRow {
  id: number;
  job_id: number;
  started_at: string;
  finished_at: string | null;
  outcome: string | null;
  detail: string | null;
  steps: number;
  fields: number;
  llm_calls: number;
  memory_hits: number;
  duration_ms: number | null;
  screenshot: string | null;
  trace: string | null;
  shots: string | null;
}
