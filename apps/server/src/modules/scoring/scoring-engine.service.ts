// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { JobSnapshot, ProfileSnapshot } from './interfaces/snapshots.interface';
import { canonicalSkill } from '../discovery/utils/job-normalizer.util';
import { proximity } from './utils/geo.util';
import { Scores } from './interfaces/scores.interface';
import { SCORE_WEIGHTS } from './constants/scoring.constants';

// overall = technical x 0.5 + salary x 0.25 + location x 0.25
@Injectable()
export class ScoringEngine {
  private readonly weights = SCORE_WEIGHTS;

  score(profile: ProfileSnapshot, job: JobSnapshot): Scores {
    const technicalScore = this.technical(profile.skills, job.requiredSkills);
    const salaryScore = this.salary(
      profile.expectedSalary,
      job.salaryMin,
      job.salaryMax,
    );
    const locationScore = this.location(
      job.location,
      job.isRemote,
      profile.location,
      profile.remotePreferred,
      profile.willingToRelocate,
    );
    const overallScore = Math.round(
      technicalScore * this.weights.technical +
        salaryScore * this.weights.salary +
        locationScore * this.weights.location,
    );
    return {
      technicalScore,
      salaryScore,
      locationScore,
      overallScore: Math.min(100, Math.max(0, overallScore)),
    };
  }

  private technical(skills: string[], required: string[]): number {
    // Nothing to compare: neutral.
    if (required.length === 0 || skills.length === 0) {
      return 60;
    }
    const have = new Set(skills.map(canonicalSkill));
    const matched = required.filter((r) => have.has(canonicalSkill(r))).length;
    return Math.round((matched / required.length) * 100);
  }

  private salary(expected: number, min?: number, max?: number): number {
    if (!min && !max) {
      return 70;
    }
    const mid = (min ?? 0) > 0 && (max ?? 0) > 0 ? (min! + max!) / 2 : (min ?? max ?? 0);
    if (expected <= 0) {
      return 80;
    }
    if (mid >= expected) {
      return 100;
    }
    return Math.min(100, Math.round((mid / expected) * 100));
  }

  private location(
    jobLocation: string,
    isRemote: boolean,
    profileLocation: string,
    remotePreferred: boolean,
    willingToRelocate: boolean,
  ): number {
    if (isRemote) {
      return remotePreferred ? 90 : 80;
    }
    // Unknown places score neutral instead of being penalised.
    switch (proximity(profileLocation, jobLocation).relation) {
      case 'same':
        return 100;
      case 'nearby':
        return 70;
      case 'far':
        return willingToRelocate ? 60 : 30;
      default:
        return 60;
    }
  }
}