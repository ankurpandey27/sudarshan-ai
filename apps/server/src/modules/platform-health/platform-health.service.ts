// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { PLATFORM_SQL } from '../jobs/constants/job-platform.constants';
import { JobPlatform } from '../jobs/enums/job-platform.enum';
import { BROKEN_ENDINGS, BROKEN_RETRY_AFTER_MS, BROKEN_STREAK } from './constants/platform-health.constants';
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
    // A pause ends by the clock, not by a change in the data: recompute once it is over.
    // A pause ends by the clock (a cool-down, or the retry of a paused site), not by a change in the data.
    const pauseOver = (hit?.value.status === 'cooling' || hit?.value.status === 'broken') && !!hit.value.until && hit.value.until <= new Date().toISOString();
    if (hit && hit.stamp === stamp && !pauseOver) return hit.value;
    const value = this.compute(platform);
    this.cache.set(platform, { stamp, value });
    return value;
  }

  /** Changes whenever anything the health depends on changes; one cheap, indexed query. */
  private stamp(): string {
    const latest = this.storage.get<{ a: number | null; j: string | null; r: string | null }>(
      `SELECT (SELECT MAX(id) FROM attempts) a, (SELECT MAX(applied_at) FROM jobs) j,
         (SELECT MAX(reset_at) || '|' || COALESCE(MAX(cool_until), '') FROM platform_health) r`,
    );
    return `${latest?.a ?? ''}|${latest?.j ?? ''}|${latest?.r ?? ''}`;
  }

  private compute(platform: JobPlatform): PlatformHealth {
    // "Other" is every company career site and pasted link together: three unrelated sites getting
    // stuck is normal there, not one site changing. Each site's own steps are learned by the playbook.
    if (platform === JobPlatform.OTHER) return { platform, status: 'ok', recent: [] };
    const row = this.storage.get<{ reset_at: string; cool_until: string | null; cool_reason: string | null }>(
      'SELECT reset_at, cool_until, cool_reason FROM platform_health WHERE platform = ?',
      [platform],
    );
    // The site is refusing applications for now: paused until then, whatever else is going on.
    if (row?.cool_until && row.cool_until > new Date().toISOString()) {
      return { platform, status: 'cooling', recent: row.cool_reason ? [row.cool_reason] : [], until: row.cool_until };
    }
    const resetAt = row?.reset_at ?? '';
    const lastSuccess =
      this.storage.get<{ at: string | null }>(`SELECT MAX(applied_at) at FROM jobs WHERE status = 'applied' AND ${PLATFORM_SQL} = ?`, [platform])?.at ?? '';
    // Only attempts after the latest success or "Try again" count.
    const since = resetAt > lastSuccess ? resetAt : lastSuccess;
    const recent = this.storage.all<{ result: string | null; detail: string | null; started_at: string }>(
      `SELECT a.result, a.detail, a.started_at FROM attempts a JOIN jobs j ON j.id = a.job_id
       WHERE a.result IS NOT NULL AND a.started_at > ? AND ${PLATFORM_SQL} = ?
         -- Stuck on the company's own site (reached from LinkedIn): that site's problem, not LinkedIn changing.
         AND COALESCE(a.trace, '') NOT LIKE '%Company site:%'
       ORDER BY a.id DESC LIMIT ?`,
      [since, platform, BROKEN_STREAK],
    );
    const stuck = recent.length === BROKEN_STREAK && recent.every((r) => BROKEN_ENDINGS.includes(r.result ?? ''));
    // A pause is never for ever: some time after the last stuck attempt, one new attempt is made. It either
    // works (the site is back) or gets stuck too - and the platform pauses again, from then.
    const retryAt = stuck ? new Date(Date.parse(recent[0].started_at) + BROKEN_RETRY_AFTER_MS).toISOString() : null;
    const broken = stuck && retryAt! > new Date().toISOString();
    const status = broken ? 'broken' : resetAt && resetAt > lastSuccess ? 'careful' : 'ok';
    return {
      platform,
      status,
      recent: broken ? recent.map((r) => r.detail ?? '').filter(Boolean) : [],
      ...(status === 'careful' ? { since: resetAt } : {}),
      ...(broken ? { until: retryAt! } : {}),
    };
  }

  all(): PlatformHealth[] {
    return Object.values(JobPlatform).map((p) => this.state(p));
  }

  /**
   * The site refused an application for now (e.g. Naukri: "please try again later" after many in a
   * row): no applications there until the pause is over, then it simply carries on.
   */
  coolDown(platform: JobPlatform, forMs: number, reason: string): PlatformHealth {
    const until = new Date(Date.now() + forMs).toISOString();
    this.storage.run(
      `INSERT INTO platform_health (platform, reset_at, cool_until, cool_reason) VALUES (?, '', ?, ?)
       ON CONFLICT(platform) DO UPDATE SET cool_until = excluded.cool_until, cool_reason = excluded.cool_reason`,
      [platform, until, reason.slice(0, 300)],
    );
    return this.state(platform);
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
