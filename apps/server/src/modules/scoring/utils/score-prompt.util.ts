// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { compressText } from '../../../common/utils/text.util';
import { Job } from '../../jobs/interfaces/job.interface';
import { LLM_DESCRIPTION_CHARS } from '../constants/scoring.constants';
import { ProfileSnapshot } from '../interfaces/snapshots.interface';
import { UNTRUSTED_RULE, untrusted } from '../../llm/utils/untrusted.util';

export const SCORE_SYSTEM_PROMPT =
  'You are a strict technical recruiter. Judge how well each job fits the candidate. Be realistic: seniority mismatch and missing core skills lower the score. ' +
  UNTRUSTED_RULE;

export function buildBatchScorePrompt(profile: ProfileSnapshot, jobs: Job[]): string {
  const candidate = `role=${profile.currentRole ?? '-'}; years=${profile.yearsExperience}; skills=${profile.skills.slice(0, 50).join(', ')}; location=${profile.location}; remote_ok=${profile.remotePreferred}; expected_salary=${profile.expectedSalary || 'n/a'} ${profile.salaryCurrency}`;
  const list = jobs
    .map(
      (j) =>
        `[${j.id}] ${j.title} @ ${j.company} | ${j.location || 'n/a'}${j.isRemote ? ' (remote)' : ''} | salary: ${j.salaryRaw ?? 'n/a'}\n${untrusted(`job ${j.id}`, compressText(j.description, LLM_DESCRIPTION_CHARS))}`,
    )
    .join('\n\n');
  return `CANDIDATE: ${candidate}${profile.summary ? `\nSUMMARY: ${compressText(profile.summary, 300)}` : ''}

JOBS:
${list}

For every job return a fit score 0-100 (90+ ideal, 70-89 strong, 50-69 partial, <50 poor), a one-line reason, and the candidate's matched / missing key skills.
Return JSON: {"scores":[{"id":<job id>,"score":<0-100>,"summary":"<max 15 words>","matched":["..."],"missing":["..."]}]}`;
}
