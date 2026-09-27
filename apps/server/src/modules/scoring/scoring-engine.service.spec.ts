// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { ScoringEngine } from './scoring-engine.service';
import { ProfileSnapshot, JobSnapshot } from './interfaces/snapshots.interface';

const profile: ProfileSnapshot = {
  yearsExperience: 3,
  skills: ['node', 'typescript', 'postgresql'],
  expectedSalary: 15_00_000,
  salaryCurrency: 'INR',
  location: 'India',
  remotePreferred: true,
  willingToRelocate: false,
  searchLocations: [],
};

const job = (over: Partial<JobSnapshot>): JobSnapshot => ({
  title: 'Backend Engineer',
  company: 'Acme',
  location: 'India',
  isRemote: false,
  requiredSkills: ['node', 'typescript'],
  description: 'Backend role',
  ...over,
});

describe('ScoringEngine', () => {
  const engine = new ScoringEngine();

  it('perfect match scores 100', () => {
    const s = engine.score(
      profile,
      job({
        location: 'India',
        isRemote: false,
        salaryMin: 15_00_000,
        salaryMax: 18_00_000,
      }),
    );
    // technical 100, salary 100 (mid 16.5L >= exp 15L), location 100
    expect(s.overallScore).toBe(100);
  });

  it('salary far below expectation drags the score down', () => {
    const s = engine.score(
      profile,
      job({ salaryMin: 5_00_000, salaryMax: 6_00_000 }),
    );
    expect(s.salaryScore).toBeLessThan(100);
    expect(s.overallScore).toBeLessThan(100);
  });

  it('remote job favours a remote-preferring profile', () => {
    const s = engine.score(profile, job({ isRemote: true }));
    expect(s.locationScore).toBe(90);
  });

  it('unreachable remote=false location scores low', () => {
    const s = engine.score(
      profile,
      job({ location: 'San Francisco, USA', isRemote: false }),
    );
    expect(s.locationScore).toBeLessThanOrEqual(30);
  });

  it('no required skills yields neutral technical score', () => {
    const s = engine.score(profile, job({ requiredSkills: [] }));
    expect(s.technicalScore).toBe(60);
  });
});