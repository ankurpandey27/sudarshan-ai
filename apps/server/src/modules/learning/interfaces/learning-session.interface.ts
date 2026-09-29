// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { LearnedMove } from '../../form-engine/interfaces/learned-move.interface';

export interface LearningSession {
  /** Field values already present (filled by the site, the agent or earlier learning), keyed by question. */
  known: Map<string, string>;
  /** The button just clicked; it counts as a step once the form shows different questions. */
  /** `signature`: the kind of step the button was pressed on, for the site's playbook. */
  pending: { kind: 'apply' | 'advance'; text: string; fingerprint: string; signature: string } | null;
  /** Buttons you pressed that moved the form on; learned only when the application is confirmed. */
  moves: LearnedMove[];
  answers: number;
  steps: number;
  done: boolean;
}
