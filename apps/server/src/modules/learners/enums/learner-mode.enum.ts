// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export enum LearnerMode {
  /** Switched off in Settings. */
  OFF = 'off',
  /** Not enough examples yet to learn anything. */
  LEARNING = 'learning',
  /** Predicting quietly; its predictions are checked but not used until it is right often enough. */
  CHECKING = 'checking',
  /** Right often enough on checks it had not seen: its predictions are used. */
  ON = 'on',
}
