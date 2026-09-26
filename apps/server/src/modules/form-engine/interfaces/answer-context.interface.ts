import { CandidateProfile } from '../../profile/interfaces/candidate-profile.interface';

export interface AnswerJobContext {
  id: number;
  title: string;
  company: string;
  location: string;
  description: string;
}

export interface AnswerContext {
  profile: CandidateProfile;
  job: AnswerJobContext;
  resumePath: string | null;
  /** null when the skill is not in the profile. */
  skillYears: (skill: string) => number | null;
}

export interface RuleAnswer {
  value: string;
  /** false for a default rather than a fact from the profile. */
  confident: boolean;
}
