// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { CandidateProfile } from '../interfaces/candidate-profile.interface';

export const EMPTY_PROFILE: CandidateProfile = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  phoneCountryCode: '+91',
  city: '',
  state: '',
  country: 'India',
  postalCode: '',
  headline: '',
  currentTitle: '',
  currentCompany: '',
  totalYearsExperience: 0,
  noticePeriodDays: null,
  currentCtc: null,
  expectedCtc: null,
  currency: 'INR',
  willingToRelocate: true,
  cleanRecord: false,
  remotePreferred: true,
  workAuthorization: '',
  needsSponsorship: false,
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: '',
  skills: [],
  education: [],
  experience: [],
  languages: ['English'],
  summary: '',
  gender: '',
  dateOfBirth: '',
};

// Asked by nearly every job form.
export const ESSENTIAL_FIELDS: (keyof CandidateProfile)[] = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'city',
  'currentTitle',
  'totalYearsExperience',
  'noticePeriodDays',
  'currentCtc',
  'expectedCtc',
];

export const RESUME_MAX_BYTES = 10 * 1024 * 1024;

export const RESUME_PROMPT_CHARS = 14_000;

// A resume re-upload never overwrites these.
export const USER_OWNED_FIELDS: (keyof CandidateProfile)[] = [
  'noticePeriodDays',
  'currentCtc',
  'expectedCtc',
  'currency',
  'willingToRelocate',
  'cleanRecord',
  'remotePreferred',
  'workAuthorization',
  'needsSponsorship',
  'gender',
  'dateOfBirth',
];
