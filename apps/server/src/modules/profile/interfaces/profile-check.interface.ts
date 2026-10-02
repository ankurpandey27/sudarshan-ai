// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface SkillGap {
  /** The skill, as jobs name it. */
  skill: string;
  /** Jobs found recently that asked for it. */
  jobs: number;
  /** Why it is listed: on your resume but not your skills, covered by skills you have, or simply not in your profile. */
  why: 'on_resume' | 'covered' | 'missing';
  /** For "covered": your skills that count towards it (MySQL and PostgreSQL for SQL). */
  coveredBy?: string[];
}

export interface ProfileTip {
  id: string;
  text: string;
  /** Where to fix it in the app. */
  to?: string;
}

/** What would make your profile match more jobs, from the jobs Sudarshan has found. */
export interface ProfileCheck {
  /** Jobs the check is based on. */
  jobs: number;
  /** Add in one click: you have these (on your resume, or through related skills) but they are not in your skills list. */
  quickAdds: SkillGap[];
  /** Asked for often and nowhere in your profile: add them only if you have them. */
  missing: SkillGap[];
  /** Skills with no years: "How many years of X?" falls back on your total experience. */
  noYears: string[];
  tips: ProfileTip[];
}
