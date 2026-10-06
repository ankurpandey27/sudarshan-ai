// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { canonicalSkill, extractSkills } from '../../discovery/utils/job-normalizer.util';
import { escapeRegex } from '../../../common/utils/regex.util';
import { SKILL_WEIGHT, TITLE_WEIGHT } from '../constants/resumes.constants';

export interface ResumeCandidate {
  id: number;
  forJobs: string[];
  skills: string[];
}

const has = (text: string, word: string) => new RegExp(`(?<![a-z0-9])${escapeRegex(word.toLowerCase())}(?![a-z0-9])`, 'i').test(text);

/**
 * The extra resume made for this kind of job: the one whose words appear in the job's title (or failing that, its
 * description) the most. Null - your main resume - when none of them is clearly about this job.
 */
export function pickResume(job: { title: string; description: string }, resumes: ResumeCandidate[]): number | null {
  const jobSkills = new Set(extractSkills(`${job.title} ${job.description}`));
  let best: { id: number; score: number } | null = null;
  let tie = false;
  for (const resume of resumes) {
    const words = resume.forJobs.map((w) => w.trim()).filter(Boolean);
    const fit = words.reduce((n, w) => n + (has(job.title, w) ? TITLE_WEIGHT : has(job.description, w) ? 1 : 0), 0);
    if (fit === 0) continue;
    const score = fit + SKILL_WEIGHT * resume.skills.filter((s) => jobSkills.has(canonicalSkill(s))).length;
    if (!best || score > best.score) {
      best = { id: resume.id, score };
      tie = false;
    } else if (score === best.score) tie = true;
  }
  return best && !tie ? best.id : null;
}
