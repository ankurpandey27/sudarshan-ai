// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Jobs found in this many days count for the profile check. */
export const PROFILE_CHECK_DAYS = 60;

/** Skills shown per list. */
export const PROFILE_CHECK_LIMIT = 12;

/** A skill wanted by fewer jobs than this is not worth a line. */
export const PROFILE_CHECK_MIN_JOBS = 3;

/** Words jobs list as "skills" that are really kinds of role - nothing to add to a profile. */
export const NOT_A_SKILL = new Set([
  'backend',
  'back end',
  'back-end',
  'frontend',
  'front end',
  'front-end',
  'full stack',
  'fullstack',
  'full-stack',
  'software',
  'development',
  'engineering',
  'programming',
  'coding',
  'web',
  'communication',
  'teamwork',
]);

/** Different names jobs use for the same skill (on top of the discovery aliases). */
export const CHECK_ALIASES: Record<string, string> = {
  golang: 'go',
  js: 'javascript',
  ts: 'typescript',
  'data structure': 'data structures',
  algorithm: 'algorithms',
  'design pattern': 'design patterns',
};

/** Fewer stories than this, and written answers fall back on the resume. */
export const MIN_STORIES = 3;
