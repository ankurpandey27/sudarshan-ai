// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** The ranges the dashboard offers, in days. */
export const ANALYTICS_RANGES = [7, 30, 90] as const;
export const ANALYTICS_DEFAULT_DAYS = 30;
/** Most-asked missing skills shown. */
export const TOP_MISSING_SKILLS = 8;
/** A "skill" longer than this is usually a sentence from the AI, not a skill. */
export const MAX_SKILL_LENGTH = 24;
/** Statuses a job reaches once it is liked enough to review. */
export const MATCHED_STATUSES = ['review', 'approved', 'applying', 'applied', 'manual', 'failed', 'needs_input'];
/** Statuses a job reaches once it is approved. */
export const APPROVED_STATUSES = ['approved', 'applying', 'applied', 'manual', 'failed', 'needs_input'];
/** Different names jobs use for the same skill, counted together. */
export const SKILL_ALIASES: Record<string, string> = {
  go: 'golang',
  reactjs: 'react',
  'react.js': 'react',
  nodejs: 'node.js',
  node: 'node.js',
  k8s: 'kubernetes',
  js: 'javascript',
  ts: 'typescript',
  postgres: 'postgresql',
  mongo: 'mongodb',
  spring: 'spring boot',
};
