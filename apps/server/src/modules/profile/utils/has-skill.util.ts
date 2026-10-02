// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { canonicalSkill } from '../../discovery/utils/job-normalizer.util';
import { SKILL_FAMILIES } from '../constants/skill-families.constants';

/**
 * Whether skills you have (canonical names) cover one a job asks for - itself, or a skill that counts towards it:
 * a job asking for "SQL" is matched by your MySQL or PostgreSQL, "Node.js" by your NestJS.
 */
export function hasSkill(have: Set<string>, skill: string): boolean {
  const s = canonicalSkill(skill);
  return have.has(s) || (SKILL_FAMILIES[s] ?? []).some((m) => have.has(m));
}
