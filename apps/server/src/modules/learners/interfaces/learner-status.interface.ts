// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { LearnerMode } from '../enums/learner-mode.enum';
import { LearnerName } from '../enums/learner-name.enum';

/** How well a learner did on cases it had not seen (held-out examples, or live checks). */
export interface LearnerMetrics {
  /** Cases it was checked on. */
  checked: number;
  /** Of those, how many it got right. */
  right: number;
  /** right / checked, or null with no checks. */
  accuracy: number | null;
  /** How it was checked, in plain words ("5-fold on your examples", "live, on your applications"). */
  how: string;
}

export interface LearnerStatus {
  name: LearnerName;
  label: string;
  mode: LearnerMode;
  enabled: boolean;
  examples: number;
  /** Examples needed before it starts learning; 0 when it has enough. */
  needed: number;
  metrics: LearnerMetrics | null;
  trainedAt: string | null;
  /** One line: what it does now and why. */
  note: string;
}
