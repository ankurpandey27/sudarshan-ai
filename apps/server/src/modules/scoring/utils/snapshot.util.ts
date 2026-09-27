// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Job, ScoreDetail } from '../../jobs/interfaces/job.interface';
import { CandidateProfile } from '../../profile/interfaces/candidate-profile.interface';
import { JobSnapshot, ProfileSnapshot } from '../interfaces/snapshots.interface';

export function toProfileSnapshot(p: CandidateProfile, searchLocations: string[] = []): ProfileSnapshot {
  return {
    currentRole: p.currentTitle,
    yearsExperience: p.totalYearsExperience,
    skills: p.skills.map((s) => s.name),
    expectedSalary: p.expectedCtc ?? 0,
    salaryCurrency: p.currency,
    location: [p.city, p.country].filter(Boolean).join(', ') || 'India',
    remotePreferred: p.remotePreferred,
    willingToRelocate: p.willingToRelocate === true,
    searchLocations: searchLocations.filter((l) => l.trim() && !/^remote$/i.test(l.trim())),
    summary: p.summary,
  };
}

export function toJobSnapshot(j: Job): JobSnapshot {
  return {
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    isRemote: j.isRemote,
    salaryMin: j.salaryMin ?? undefined,
    salaryMax: j.salaryMax ?? undefined,
    salaryRaw: j.salaryRaw ?? undefined,
    requiredSkills: j.skills,
    description: j.description,
  };
}

export function emptyDetail(summary: string): ScoreDetail {
  return { technical: 0, salary: 0, location: 0, engine: 0, llm: null, matchedSkills: [], missingSkills: [], summary };
}
