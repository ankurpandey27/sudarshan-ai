// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** AI steps one rescue may take, at most. */
export const RESCUE_MAX_STEPS = 8;
/** Actions per step, at most. */
export const RESCUE_MAX_ACTIONS = 5;
/** Steps in a row that change nothing before the rescue gives up. */
export const RESCUE_MAX_IDLE = 2;
/** Rescues in a row that fail with the same AI model before rescues pause for it. */
export const RESCUE_PAUSE_AFTER = 5;
/** How much of the page is shown to the AI, by how short the prompt must be (a model's limit was hit). */
export const RESCUE_SIZES = [
  { items: 80, text: 1800 },
  { items: 40, text: 900 },
  { items: 20, text: 400 },
];
