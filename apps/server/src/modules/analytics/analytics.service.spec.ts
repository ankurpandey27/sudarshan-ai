// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { StorageService } from '../../common/storage/storage.service';
import { localDay } from '../../common/utils/date.util';
import { JobPlatform } from '../jobs/enums/job-platform.enum';
import { AnalyticsService } from './analytics.service';
import { isSkillName } from './utils/day-series.util';

describe('AnalyticsService', () => {
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  let seq = 0;
  const add = (s: StorageService, o: { source?: string; url?: string; status: string; score?: number; found: string; applied?: string; detail?: object }) =>
    s.run(
      `INSERT INTO jobs (source, external_id, url, title, status, score, score_detail, discovered_at, updated_at, applied_at)
       VALUES (?, ?, ?, 'Backend', ?, ?, ?, ?, ?, ?)`,
      [
        o.source ?? 'linkedin',
        String(++seq),
        o.url ?? `https://example.com/${seq}`,
        o.status,
        o.score ?? null,
        o.detail ? JSON.stringify(o.detail) : null,
        o.found,
        o.found,
        o.applied ?? null,
      ],
    );

  const setup = () => {
    const s = new StorageService(':memory:');
    add(s, { status: 'applied', score: 82, found: daysAgo(0), applied: daysAgo(0), detail: { missingSkills: ['kafka', 'Kafka '] } });
    add(s, {
      source: 'naukri',
      status: 'applied',
      score: 74,
      found: daysAgo(2),
      applied: daysAgo(1),
      detail: { missingSkills: ['kafka', '1-3 years of Java'] },
    });
    add(s, { source: 'web', url: 'https://www.instahyre.com/job-1/', status: 'review', score: 66, found: daysAgo(1) });
    add(s, { status: 'skipped', score: 20, found: daysAgo(3), detail: { skipRule: 'missing_skills', missingSkills: ['java'] } });
    add(s, { status: 'skipped', score: 30, found: daysAgo(3), detail: { skipRule: 'location' } });
    add(s, { status: 'applied', score: 90, found: daysAgo(12), applied: daysAgo(10) }); // previous week
    return new AnalyticsService(s);
  };

  it('counts this range against the one before it', () => {
    const r = setup().report({ days: 7 });
    expect(r.current).toEqual({ found: 5, applied: 2 });
    expect(r.previous).toEqual({ found: 1, applied: 1 });
  });

  it('builds a day-by-day series with applications split by platform', () => {
    const r = setup().report({ days: 7 });
    expect(r.daily).toHaveLength(7);
    expect(r.daily.at(-1)).toMatchObject({ day: localDay(), applied: { [JobPlatform.LINKEDIN]: 1 } });
    expect(r.daily.reduce((n, d) => n + d.found, 0)).toBe(5);
  });

  it('follows found jobs down the pipeline and buckets their scores', () => {
    const r = setup().report({ days: 7 });
    expect(r.pipeline).toEqual({ found: 5, scored: 5, matched: 3, approved: 2, applied: 2 });
    expect(r.scores.find((b) => b.bucket === 8)).toEqual({ bucket: 8, jobs: 1, applied: 1 });
  });

  it('explains skips, lists missing skills, and splits by platform', () => {
    const r = setup().report({ days: 7 });
    expect(r.skipReasons.map((x) => x.rule).sort()).toEqual(['location', 'missing_skills']);
    expect(r.missingSkills[0]).toEqual({ skill: 'kafka', jobs: 3 });
    expect(r.missingSkills.some((x) => /year/.test(x.skill))).toBe(false);
    expect(r.byPlatform.find((p) => p.platform === JobPlatform.INSTAHYRE)).toEqual({ platform: JobPlatform.INSTAHYRE, found: 1, applied: 0 });
  });

  it('narrows everything but the platform split to one platform', () => {
    const r = setup().report({ days: 7, platform: JobPlatform.NAUKRI });
    expect(r.current).toEqual({ found: 1, applied: 1 });
    expect(r.byPlatform.length).toBeGreaterThan(1);
  });

  it('counts different names for one skill together, and says how to fix each skip', () => {
    const s = new StorageService(':memory:');
    add(s, { status: 'skipped', score: 10, found: daysAgo(0), detail: { skipRule: 'location', missingSkills: ['Go', 'golang', 'ReactJS'] } });
    const r = new AnalyticsService(s).report({ days: 7 });
    expect(r.missingSkills).toEqual([
      { skill: 'golang', jobs: 2 },
      { skill: 'react', jobs: 1 },
    ]);
    expect(r.skipReasons[0].fix).toMatch(/Remote|relocate/);
  });

  it('keeps skill names and drops sentences', () => {
    expect(['node.js', 'system design', 'api gateway'].every((s) => isSkillName(s, 24))).toBe(true);
    expect(['1-3 years', 'explicit event-driven architecture project experience'].some((s) => isSkillName(s, 24))).toBe(false);
  });
});
