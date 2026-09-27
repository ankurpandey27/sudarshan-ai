// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { PLATFORM_SQL } from '../jobs/constants/job-platform.constants';
import { JobPlatform } from '../jobs/enums/job-platform.enum';
import { BROKEN_ENDINGS, BROKEN_STREAK } from './constants/platform-health.constants';
import { PlatformHealth } from './interfaces/platform-health.interface';

/**
 * Notices when a platform seems to have changed its pages: several applications in a row got
 * stuck. The agent then stops using it instead of failing silently, and resumes carefully.
 */
@Injectable()
export class PlatformHealthService {
  // The status is polled every few seconds; recompute only when attempts, applications or a retry changed.
  private readonly cache = new Map<JobPlatform, { stamp: string; value: PlatformHealth }>();

  constructor(private readonly storage: StorageService) {}

  state(platform: JobPlatform): PlatformHealth {
    const stamp = this.stamp();
    const hit = this.cache.get(platform);
    if (hit && hit.stamp === stamp) return hit.value;
    const value = this.compute(platform);
    this.cache.set(platform, { stamp, value });
    return value;
  }

  /** Changes whenever anything the health depends on changes; one cheap, indexed query. */
  private stamp(): string {
    const r = this.storage.get<{ a: number | null; j: string | null; r: string | null }>(
      `SELECT (SELECT MAX(id) FROM attempts) a, (SELECT MAX(applied_at) FROM jobs) j, (SELECT MAX(reset_at) FROM platform_health) r`,
    );
    return `${r?.a ?? ''}|${r?.j ?? ''}|${r?.r ?? ''}`;
  }

  private compute(platform: JobPlatform): PlatformHealth {
    // "Other" is every company career site and pasted link together: three unrelated sites getting
    // stuck is normal there, not one site changing. Each site's own steps are learned by the playbook.
    if (platform === JobPlatform.OTHER) return { platform, status: 'ok', recent: [] };
    const resetAt = this.storage.get<{ reset_at: string }>('SELECT reset_at FROM platform_health WHERE platform = ?', [platform])?.reset_at ?? '';
    const lastSuccess =
      this.storage.get<{ at: string | null }>(`SELECT MAX(applied_at) at FROM jobs WHERE status = 'applied' AND ${PLATFORM_SQL} = ?`, [platform])?.at ?? '';
    // Only attempts after the latest success or "Try again" count.
    const since = resetAt > lastSuccess ? resetAt : lastSuccess;
    const recent = this.storage.all<{ result: string | null; detail: string | null }>(
      `SELECT a.result, a.detail FROM attempts a JOIN jobs j ON j.id = a.job_id
       WHERE a.result IS NOT NULL AND a.started_at > ? AND ${PLATFORM_SQL} = ?
       ORDER BY a.id DESC LIMIT ?`,
      [since, platform, BROKEN_STREAK],
    );
    const broken = recent.length === BROKEN_STREAK && recent.every((r) => BROKEN_ENDINGS.includes(r.result ?? ''));
    const status = broken ? 'broken' : resetAt && resetAt > lastSuccess ? 'careful' : 'ok';
    return { platform, status, recent: broken ? recent.map((r) => r.detail ?? '').filter(Boolean) : [] };
  }

  all(): PlatformHealth[] {
    return Object.values(JobPlatform).map((p) => this.state(p));
  }

  /** "Try again": resume a paused platform in careful mode. */
  retry(platform: JobPlatform): PlatformHealth {
    this.storage.run('INSERT INTO platform_health (platform, reset_at) VALUES (?, ?) ON CONFLICT(platform) DO UPDATE SET reset_at = excluded.reset_at', [
      platform,
      new Date().toISOString(),
    ]);
    return this.state(platform);
  }
}
