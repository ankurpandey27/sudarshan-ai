// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { PROFILE_CHECK_DAYS } from './constants/profile-check.constants';
import { ProfileCheck } from './interfaces/profile-check.interface';
import { ProfileService } from './profile.service';
import { buildProfileCheck } from './utils/profile-check.util';

/** What would make your profile match more of the jobs Sudarshan finds for you. */
@Injectable()
export class ProfileCheckService {
  constructor(
    private readonly storage: StorageService,
    private readonly profile: ProfileService,
  ) {}

  check(): ProfileCheck {
    const since = new Date(Date.now() - PROFILE_CHECK_DAYS * 86_400_000).toISOString();
    const rows = this.storage.all<{ skills: string | null; missing: string | null }>(
      "SELECT skills, json_extract(score_detail, '$.missingSkills') missing FROM jobs WHERE discovered_at >= ?",
      [since],
    );
    const list = (raw: string | null): string[] => {
      try {
        const parsed = JSON.parse(raw ?? '[]') as unknown;
        return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
      } catch {
        return [];
      }
    };
    const stories = Number(this.storage.get<{ n: number }>('SELECT COUNT(*) n FROM stories')?.n ?? 0);
    return buildProfileCheck({
      profile: this.profile.state().profile,
      resumeText: this.profile.resumeText(),
      jobs: rows.map((r) => ({ skills: list(r.skills), missing: list(r.missing) })),
      stories,
    });
  }
}
