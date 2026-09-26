import { CandidateProfile } from './candidate-profile.interface';

export interface ProfileState {
  profile: CandidateProfile;
  resume: { name: string; uploadedAt: string } | null;
  missing: (keyof CandidateProfile)[];
  parsedWith: 'ai' | 'basic' | null;
}
