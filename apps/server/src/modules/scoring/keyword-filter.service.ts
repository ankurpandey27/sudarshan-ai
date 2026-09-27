// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { JobSnapshot, ProfileSnapshot } from './interfaces/snapshots.interface';
import { canonicalSkill } from '../discovery/utils/job-normalizer.util';
import { isReachable } from './utils/geo.util';
import { FilterVerdict } from './interfaces/filter-verdict.interface';
import { SkipRule } from './enums/skip-rule.enum';

const lakhs = (n: number): string => `${+(n / 1e5).toFixed(1)} L`;

@Injectable()
export class KeywordFilterService {
  private readonly salaryFloorRatio = 0.7;

  filter(profile: ProfileSnapshot, job: JobSnapshot): FilterVerdict {
    // Skip only when even the top of the range is under 70% of expectation (5-15L can still meet 12L).
    const best = job.salaryMax ?? job.salaryMin;
    if (profile.expectedSalary > 0 && best != null && best > 0) {
      const floor = profile.expectedSalary * this.salaryFloorRatio;
      if (best < floor) {
        return {
          outcome: 'SKIP',
          reason: `Pays up to ${lakhs(best)}, well below your expected ${lakhs(profile.expectedSalary)}`,
          rule: SkipRule.SALARY,
        };
      }
    }

    const reachable =
      profile.willingToRelocate ||
      isReachable(profile.location, job.location) ||
      profile.searchLocations.some((place) => isReachable(place, job.location));
    if (!job.isRemote && !reachable) {
      return {
        outcome: 'SKIP',
        reason: `On-site in ${job.location}, too far from ${profile.location}`,
        rule: SkipRule.LOCATION,
      };
    }

    // An empty skill list means unknown, not "matches nothing".
    if (profile.skills.length > 0 && job.requiredSkills.length > 0 && !this.hasAnySkill(profile, job)) {
      return {
        outcome: 'SKIP',
        reason: `Needs ${job.requiredSkills.slice(0, 4).join(', ')} - none of these are in your profile`,
        rule: SkipRule.MISSING_SKILLS,
      };
    }

    return { outcome: 'PASS' };
  }

  private hasAnySkill(profile: ProfileSnapshot, job: JobSnapshot): boolean {
    const skills = new Set(profile.skills.map(canonicalSkill));
    return job.requiredSkills.some((r) => skills.has(canonicalSkill(r)));
  }
}
