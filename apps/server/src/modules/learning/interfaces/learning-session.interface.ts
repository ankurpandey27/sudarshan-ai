// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface LearningSession {
  /** Field values already present (filled by the site, the agent or earlier learning), keyed by question. */
  known: Map<string, string>;
  /** The button just clicked; it counts as a step once the form shows different questions. */
  pending: { kind: 'apply' | 'advance'; text: string; fingerprint: string } | null;
  answers: number;
  steps: number;
  done: boolean;
}
