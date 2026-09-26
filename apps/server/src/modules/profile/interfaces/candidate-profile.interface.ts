export interface ProfileSkill {
  name: string;
  /** null = unknown; total experience is used instead. */
  years: number | null;
}

export interface ProfileEducation {
  degree: string;
  field: string;
  institution: string;
  startYear: number | null;
  endYear: number | null;
  grade: string;
}

export interface ProfileExperience {
  title: string;
  company: string;
  location: string;
  start: string;
  end: string;
  current: boolean;
  summary: string;
}

export interface CandidateProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phoneCountryCode: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  headline: string;
  currentTitle: string;
  currentCompany: string;
  totalYearsExperience: number;
  noticePeriodDays: number | null;
  currentCtc: number | null;
  expectedCtc: number | null;
  currency: string;
  willingToRelocate: boolean;
  remotePreferred: boolean;
  workAuthorization: string;
  needsSponsorship: boolean;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  skills: ProfileSkill[];
  education: ProfileEducation[];
  experience: ProfileExperience[];
  languages: string[];
  summary: string;
  /** Blank = prefer not to say. */
  gender: string;
  dateOfBirth: string;
}
