// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Jobs you applied to or approved before "your interest" is shown - enough to see what they share. */
export const MIN_KEPT = 15;
/** Anything in at least this share of the applications your top skill (or title word, platform) is in counts as fully liked. */
export const FULL_AFFINITY_SHARE = 0.5;
/** How much each part of a job counts towards your interest in it. */
export const INTEREST_WEIGHTS = { skill: 0.6, title: 0.25, platform: 0.15 } as const;
/** A job's best skill matches that count most... */
export const TOP_SKILLS_COUNTED = 3;
/** ...and how much the share of its skills you go for counts, next to them. */
export const SKILL_COVERAGE_WEIGHT = 0.3;
/** A skill (or word) this liked or more counts as one you go for. */
export const COVERED_AT = 0.3;
/** What a job does not say (no skills listed) counts as this - unknown, not a match. */
export const UNKNOWN_PART = 0.5;
/** Something you turn down every time halves a job's interest. */
export const AVOID_PENALTY = 0.5;
/** Reasons shown when you hover the interest. */
export const REASONS_SHOWN = 3;
/** In Auto mode, a job this unlike the ones you apply to waits for your review. */
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

/** "You like": in at least this share of the jobs you kept... */
export const LIKE_MIN_SHARE = 0.1;
/** ...and kept at least this often when it was there. */
export const LIKE_MIN_KEEP = 0.9;
/** "You skip": turned down at least this often... */
export const SKIP_MIN_RATE = 0.5;
/** ...over at least this many of your decisions. */
export const SKIP_MIN_DECISIONS = 5;
/** Shown on the taste card, each list. */
export const HABITS_SHOWN = 6;

/** Your interest is worked out this long after startup, once the app is answering. */
export const REFRESH_AFTER_START_MS = 5_000;
