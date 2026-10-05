// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { CandidateProfile } from '../../profile/interfaces/candidate-profile.interface';

export interface AnswerJobContext {
  id: number;
  title: string;
  company: string;
  location: string;
  description: string;
  /** Where the job was found, for "How did you hear about this job?" - e.g. "Naukri". */
  foundOn?: string;
}

export interface AnswerContext {
  profile: CandidateProfile;
  job: AnswerJobContext;
  resumePath: string | null;
  /** The name of the extra resume chosen for this job ("Frontend"); unset for your main resume. */
  resumeLabel?: string;
  /** null when the skill is not in the profile. */
  skillYears: (skill: string) => number | null;
  /** Your Story Bank stories that fit this job, for written answers. */
  stories?: string[];
  /** Your resume as text: what you did in each role, your projects - more than the profile's lists. */
  resumeText?: string;
}

export interface RuleAnswer {
  value: string;
  /** false for a default rather than a fact from the profile. */
  confident: boolean;
  /** Which of your details it is ("phone"), when a named rule gave it. */
  key?: string;
}
