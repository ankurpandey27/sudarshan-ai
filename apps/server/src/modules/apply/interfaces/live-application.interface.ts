// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** The application in progress, for Lakshya's Live Eye. */
export interface LiveApplication {
  jobId: number;
  attemptId: number;
  /** Step pictures taken so far; the newest is last. Served by GET /agent/live/shots/:attemptId/:index. */
  shots: { index: number; label: string; at: string }[];
}
