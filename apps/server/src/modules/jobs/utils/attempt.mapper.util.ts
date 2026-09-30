// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Attempt, AttemptRow } from '../interfaces/attempt.interface';

export function toAttempt(r: AttemptRow): Attempt {
  return {
    id: r.id,
    jobId: r.job_id,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    outcome: r.outcome,
    detail: r.detail,
    steps: r.steps,
    fields: r.fields,
    llmCalls: r.llm_calls,
    memoryHits: r.memory_hits,
    durationMs: r.duration_ms,
    screenshot: r.screenshot,
    trace: r.trace ? (JSON.parse(r.trace) as string[]) : [],
    shots: r.shots ? (JSON.parse(r.shots) as Attempt['shots']) : [],
  };
}
