// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { canonicalSkill, extractSkills } from '../../discovery/utils/job-normalizer.util';
import { TOTAL_EXPERIENCE } from '../../answers/constants/answers.constants';

/** Where your years are known: your profile, and the answers you gave yourself. */
export interface ExperienceSources {
  profileTotal: number;
  /** Your profile's years for a skill (or a related one it covers), or null if it is not there. */
  profileSkill: (skill: string) => number | null;
  /** The most years you gave yourself in answers about questions matching `about`. */
  yearsYouGave: (about: (question: string) => boolean) => number | null;
}

/**
 * Your experience, taking the highest of everything Sudarshan knows: 4.9 years from your job dates
 * and "Total experience: 5" typed by you makes 5. A skill never has more years than your whole career.
 */
export function experienceFrom(src: ExperienceSources): { total: number; skillYears: (skill: string) => number | null } {
  const typedTotal = src.yearsYouGave((q) => TOTAL_EXPERIENCE.test(q) && extractSkills(q).length === 0);
  const total = Math.max(src.profileTotal, typedTotal ?? 0);
  const skillYears = (skill: string): number | null => {
    const target = canonicalSkill(skill);
    const typed = src.yearsYouGave((q) => extractSkills(q).map(canonicalSkill).includes(target));
    const known = [src.profileSkill(skill), typed].filter((y): y is number => y !== null);
    return known.length ? Math.min(Math.max(...known), total) : null;
  };
  return { total, skillYears };
}
