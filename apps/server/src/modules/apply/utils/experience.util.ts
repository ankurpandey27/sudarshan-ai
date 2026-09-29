// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { canonicalSkill, extractSkills } from '../../discovery/utils/job-normalizer.util';
import { TOTAL_EXPERIENCE } from '../../answers/constants/answers.constants';

/** Where your years are known: your profile, and the answers you gave yourself. */
export interface ExperienceSources {
  profileTotal: number;
  /** Your profile's years for a skill (or a related one), counting a skill listed without years as your whole career; null if not there. */
  profileSkill: (skill: string) => number | null;
  /** Only the years your profile states for the skill; null when listed without years. Defaults to profileSkill. */
  statedSkill?: (skill: string) => number | null;
  /** The most years you gave yourself in answers about questions matching `about`. */
  yearsYouGave: (about: (question: string) => boolean) => number | null;
}

/**
 * Your experience, taking the highest of what is known: 4.9 years from your job dates and
 * "Total experience: 5" typed by you makes 5. A number - stated in your profile or typed by you -
 * beats a skill listed without years (React listed, "React: 2" typed: 2, not your whole career).
 * A skill never has more years than your whole career.
 */
export function experienceFrom(src: ExperienceSources): { total: number; skillYears: (skill: string) => number | null } {
  const typedTotal = src.yearsYouGave((q) => TOTAL_EXPERIENCE.test(q) && extractSkills(q).length === 0);
  const total = Math.max(src.profileTotal, typedTotal ?? 0);
  const stated = src.statedSkill ?? src.profileSkill;
  const skillYears = (skill: string): number | null => {
    const target = canonicalSkill(skill);
    const typed = src.yearsYouGave((q) => extractSkills(q).map(canonicalSkill).includes(target));
    const known = [stated(skill), typed].filter((y): y is number => y !== null);
    const years = known.length ? Math.max(...known) : src.profileSkill(skill);
    return years === null ? null : Math.min(years, total);
  };
  return { total, skillYears };
}
