// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { SQLInputValue } from 'node:sqlite';
import { StorageService } from '../../common/storage/storage.service';
import { PLATFORM_SQL } from '../jobs/constants/job-platform.constants';
import { JobPlatform } from '../jobs/enums/job-platform.enum';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { SKIP_RULE_FIX, SKIP_RULE_TEXT } from '../scoring/constants/skip-rule.constants';
import { SkipRule } from '../scoring/enums/skip-rule.enum';
import {
  ANALYTICS_DEFAULT_DAYS,
  APPROVED_STATUSES,
  MATCHED_STATUSES,
  MAX_SKILL_LENGTH,
  SKILL_ALIASES,
  TOP_MISSING_SKILLS,
} from './constants/analytics.constants';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsDay, AnalyticsPeriod, AnalyticsReport } from './interfaces/analytics-report.interface';
import { daySeries, dayStartIso, isSkillName } from './utils/day-series.util';

const inList = (values: string[]): string => values.map((v) => `'${v}'`).join(', ');

/** Numbers behind the dashboard charts. Days are the computer's local days. */
@Injectable()
export class AnalyticsService {
  constructor(private readonly storage: StorageService) {}

  report(q: AnalyticsQueryDto): AnalyticsReport {
    const days = q.days ?? ANALYTICS_DEFAULT_DAYS;
    const platform = q.platform ?? null;
    const since = dayStartIso(days - 1);
    const prevSince = dayStartIso(2 * days - 1);
    // Every query can be narrowed to one platform.
    const pf = platform ? ` AND ${PLATFORM_SQL} = ?` : '';
    const pp: SQLInputValue[] = platform ? [platform] : [];

    const count = (sql: string, params: SQLInputValue[]): number => Number(this.storage.get<{ n: number }>(sql, params)?.n ?? 0);
    const period = (from: string, to: string | null): AnalyticsPeriod => ({
      found: count(`SELECT COUNT(*) n FROM jobs WHERE discovered_at >= ?${to ? ' AND discovered_at < ?' : ''}${pf}`, [from, ...(to ? [to] : []), ...pp]),
      applied: count(`SELECT COUNT(*) n FROM jobs WHERE status = ? AND applied_at >= ?${to ? ' AND applied_at < ?' : ''}${pf}`, [
        JobStatus.APPLIED,
        from,
        ...(to ? [to] : []),
        ...pp,
      ]),
    });

    return {
      days,
      platform,
      daily: this.daily(days, since, pf, pp),
      current: period(since, null),
      previous: period(prevSince, since),
      pipeline: {
        found: count(`SELECT COUNT(*) n FROM jobs WHERE discovered_at >= ?${pf}`, [since, ...pp]),
        scored: count(`SELECT COUNT(*) n FROM jobs WHERE discovered_at >= ? AND score IS NOT NULL${pf}`, [since, ...pp]),
        matched: count(`SELECT COUNT(*) n FROM jobs WHERE discovered_at >= ? AND status IN (${inList(MATCHED_STATUSES)})${pf}`, [since, ...pp]),
        approved: count(`SELECT COUNT(*) n FROM jobs WHERE discovered_at >= ? AND status IN (${inList(APPROVED_STATUSES)})${pf}`, [since, ...pp]),
        applied: count(`SELECT COUNT(*) n FROM jobs WHERE discovered_at >= ? AND status = ?${pf}`, [since, JobStatus.APPLIED, ...pp]),
      },
      byPlatform: this.byPlatform(since),
      scores: this.storage
        .all<{ b: number; n: number; a: number }>(
          `SELECT MIN(score / 10, 9) b, COUNT(*) n, SUM(status = ?) a FROM jobs WHERE score IS NOT NULL AND discovered_at >= ?${pf} GROUP BY b ORDER BY b`,
          [JobStatus.APPLIED, since, ...pp],
        )
        .map((r) => ({ bucket: Number(r.b), jobs: Number(r.n), applied: Number(r.a ?? 0) })),
      skipReasons: this.storage
        .all<{ r: string | null; n: number }>(
          `SELECT json_extract(score_detail, '$.skipRule') r, COUNT(*) n FROM jobs
           WHERE status = ? AND discovered_at >= ? AND score_detail IS NOT NULL${pf} GROUP BY r ORDER BY n DESC`,
          [JobStatus.SKIPPED, since, ...pp],
        )
        .filter((r) => r.r)
        .map((r) => ({ rule: r.r!, label: SKIP_RULE_TEXT[r.r as SkipRule] ?? r.r!, fix: SKIP_RULE_FIX[r.r as SkipRule] ?? '', jobs: Number(r.n) })),
      missingSkills: this.missingSkills(since, pf, pp),
    };
  }

  /** Skills jobs wanted that the profile lacks; sentences dropped, aliases merged ("go" and "golang"). */
  private missingSkills(since: string, pf: string, pp: SQLInputValue[]): AnalyticsReport['missingSkills'] {
    const counts = new Map<string, number>();
    for (const row of this.storage.all<{ s: string; n: number }>(
      `SELECT lower(trim(value)) s, COUNT(*) n FROM jobs, json_each(json_extract(jobs.score_detail, '$.missingSkills'))
       WHERE jobs.score_detail IS NOT NULL AND discovered_at >= ?${pf} GROUP BY s ORDER BY n DESC LIMIT 80`,
      [since, ...pp],
    )) {
      if (!isSkillName(row.s, MAX_SKILL_LENGTH)) continue;
      const skill = SKILL_ALIASES[row.s] ?? row.s;
      counts.set(skill, (counts.get(skill) ?? 0) + Number(row.n));
    }
    return [...counts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_MISSING_SKILLS)
      .map(([skill, jobs]) => ({ skill, jobs }));
  }

  private daily(days: number, since: string, pf: string, pp: SQLInputValue[]): AnalyticsDay[] {
    const series = new Map<string, AnalyticsDay>(daySeries(days).map((day) => [day, { day, found: 0, applied: {} }]));
    for (const row of this.storage.all<{ d: string; n: number }>(
      `SELECT date(discovered_at, 'localtime') d, COUNT(*) n FROM jobs WHERE discovered_at >= ?${pf} GROUP BY d`,
      [since, ...pp],
    )) {
      const day = series.get(row.d);
      if (day) day.found = Number(row.n);
    }
    for (const row of this.storage.all<{ d: string; p: JobPlatform; n: number }>(
      `SELECT date(applied_at, 'localtime') d, ${PLATFORM_SQL} p, COUNT(*) n FROM jobs WHERE status = ? AND applied_at >= ?${pf} GROUP BY d, p`,
      [JobStatus.APPLIED, since, ...pp],
    )) {
      const day = series.get(row.d);
      if (day) day.applied[row.p] = Number(row.n);
    }
    return [...series.values()];
  }

  /** Always across every platform, so the split stays visible while one is filtered. */
  private byPlatform(since: string): AnalyticsReport['byPlatform'] {
    const out = new Map<JobPlatform, { platform: JobPlatform; found: number; applied: number }>();
    const row = (p: JobPlatform) => out.get(p) ?? out.set(p, { platform: p, found: 0, applied: 0 }).get(p)!;
    for (const platformRow of this.storage.all<{ p: JobPlatform; n: number }>(`SELECT ${PLATFORM_SQL} p, COUNT(*) n FROM jobs WHERE discovered_at >= ? GROUP BY p`, [
      since,
    ])) {
      row(platformRow.p).found = Number(platformRow.n);
    }
    for (const platformRow of this.storage.all<{ p: JobPlatform; n: number }>(
      `SELECT ${PLATFORM_SQL} p, COUNT(*) n FROM jobs WHERE status = ? AND applied_at >= ? GROUP BY p`,
      [JobStatus.APPLIED, since],
    )) {
      row(platformRow.p).applied = Number(platformRow.n);
    }
    return [...out.values()].sort((a, b) => b.applied - a.applied || b.found - a.found);
  }
}
