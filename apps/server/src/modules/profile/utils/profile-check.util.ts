// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { canonicalSkill, extractSkills } from '../../discovery/utils/job-normalizer.util';
import { SKILL_FAMILIES } from '../constants/skill-families.constants';
import { CHECK_ALIASES, MIN_STORIES, NOT_A_SKILL, PROFILE_CHECK_LIMIT, PROFILE_CHECK_MIN_JOBS } from '../constants/profile-check.constants';
import { CandidateProfile } from '../interfaces/candidate-profile.interface';
import { ProfileCheck, ProfileTip, SkillGap } from '../interfaces/profile-check.interface';

export interface ProfileCheckInput {
  profile: CandidateProfile;
  resumeText: string;
  /** Per job found recently: the skills it asked for, and those scoring found missing from your profile. */
  jobs: { skills: string[]; missing: string[] }[];
  stories: number;
}

/** One name per skill: "Golang" and "go", "Java" and "java" count together. */
export const skillKey = (s: string): string => {
  const canonical = canonicalSkill(s.replace(/\s+/g, ' '));
  return CHECK_ALIASES[canonical] ?? canonical;
};

const isSkill = (s: string): boolean => s.length > 1 && s.length <= 30 && !/\d{2,}/.test(s) && s.split(' ').length <= 3 && !NOT_A_SKILL.has(s);

export function buildProfileCheck({ profile, resumeText, jobs, stories }: ProfileCheckInput): ProfileCheck {
  const have = new Set(profile.skills.map((s) => skillKey(s.name)));
  const onResume = new Set(extractSkills(resumeText).map(skillKey));

  // How many jobs asked for each skill (missing or not), under one name.
  const wanted = new Map<string, number>();
  const missingIn = new Map<string, number>();
  for (const job of jobs) {
    const asked = new Set([...job.skills, ...job.missing].map(skillKey).filter(isSkill));
    for (const askedSkill of asked) wanted.set(askedSkill, (wanted.get(askedSkill) ?? 0) + 1);
    for (const missingSkill of new Set(job.missing.map(skillKey).filter(isSkill))) missingIn.set(missingSkill, (missingIn.get(missingSkill) ?? 0) + 1);
  }

  const quickAdds: SkillGap[] = [];
  const missing: SkillGap[] = [];
  for (const [skill, count] of [...wanted].sort((a, b) => b[1] - a[1])) {
    if (have.has(skill) || count < PROFILE_CHECK_MIN_JOBS) continue;
    const family = new Set((SKILL_FAMILIES[skill] ?? []).map(skillKey));
    const coveredBy = profile.skills.filter((s) => family.has(skillKey(s.name))).map((s) => s.name);
    if (coveredBy.length) {
      quickAdds.push({ skill, jobs: count, why: 'covered', coveredBy });
    } else if (onResume.has(skill)) {
      quickAdds.push({ skill, jobs: count, why: 'on_resume' });
    } else if ((missingIn.get(skill) ?? 0) >= PROFILE_CHECK_MIN_JOBS) {
      missing.push({ skill, jobs: missingIn.get(skill)!, why: 'missing' });
    }
  }

  const tips: ProfileTip[] = [];
  if (!profile.headline?.trim())
    tips.push({ id: 'headline', text: 'Add a headline (e.g. "Senior Backend Engineer - Node.js, NestJS, AWS"). Many forms ask for one.', to: '/profile' });
  if (!profile.summary?.trim())
    tips.push({ id: 'summary', text: 'Add a short summary - "Tell us about yourself" questions are answered from it.', to: '/profile' });
  if (stories < MIN_STORIES)
    tips.push({
      id: 'stories',
      text: `Answer ${MIN_STORIES - stories} more Story Bank question${MIN_STORIES - stories === 1 ? '' : 's'} - written answers then use your real work, not just your resume.`,
      to: '/stories',
    });

  return {
    jobs: jobs.length,
    quickAdds: quickAdds.slice(0, PROFILE_CHECK_LIMIT),
    missing: missing.sort((a, b) => b.jobs - a.jobs).slice(0, PROFILE_CHECK_LIMIT),
    noYears: profile.skills.filter((s) => s.years === null || s.years === 0).map((s) => s.name),
    tips,
  };
}
