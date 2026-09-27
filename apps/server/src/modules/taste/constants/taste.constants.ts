// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Decisions needed before the model is used: enough in total, and some of each kind. */
export const MIN_DECISIONS = 20;
export const MIN_EACH = 5;
/** A title word must appear in this many decided jobs to become a signal. */
export const MIN_WORD_COUNT = 2;
/** Training: plain gradient descent with a little L2, small data and fast. */
export const TRAIN_STEPS = 600;
export const LEARNING_RATE = 0.5;
export const L2 = 0.02;
/** In Auto mode, a job the model thinks you would very likely skip waits for your review. */
export const HOLD_BACK_BELOW = 0.25;
export const REFRESH_EVERY_MS = 5 * 60_000;
export const REFRESH_DEBOUNCE_MS = 3000;
/** Statuses that mean "you wanted this job" when you decided it yourself. */
export const WANTED_STATUSES = ['approved', 'applying', 'applied', 'manual', 'failed', 'needs_input'];
export const UNWANTED_STATUSES = ['skipped', 'dismissed'];
/** Words that say nothing about the kind of job. */
export const STOP_WORDS = new Set([
  'the',
  'and',
  'of',
  'for',
  'with',
  'in',
  'at',
  'a',
  'an',
  'to',
  'or',
  'we',
  'are',
  'is',
  'job',
  'role',
  'position',
  'opening',
]);
/** Features nearly every job has; shown as a reason only when nothing more specific stands out. */
export const GENERAL_FEATURES = new Set(['overall fit', 'skills match', 'salary fit', 'location fit', 'easy apply']);
