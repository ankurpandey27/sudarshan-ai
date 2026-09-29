// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger, NotFoundException, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { SQLInputValue } from 'node:sqlite';
import { StorageService } from '../../common/storage/storage.service';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { localDayStartIso } from '../../common/utils/date.util';
import { detectRemote, extractSkills, parseSalary } from '../discovery/utils/job-normalizer.util';
import { JobSource } from './enums/job-source.enum';
import { JobPlatform } from './enums/job-platform.enum';
import { PLATFORM_SQL } from './constants/job-platform.constants';
import { MERGE_KEEP_ORDER, MERGEABLE, SAME_ROLE_WINDOW_DAYS } from './constants/jobs.constants';
import { roleKey } from './utils/role-key.util';
import { JobList } from './interfaces/job-list.interface';
import { JobStatus } from './enums/job-status.enum';
import { Attempt, AttemptRow, AttemptStats } from './interfaces/attempt.interface';
import { DiscoveredJob } from './interfaces/discovered-job.interface';
import { Job, JobRow, ScoreDetail } from './interfaces/job.interface';
import { JobStats } from './interfaces/job-stats.interface';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { JobLinkDto } from './dto/job-link.dto';
import { toJob } from './utils/job.mapper.util';
import { toAttempt } from './utils/attempt.mapper.util';
import { parseJobUrl } from './utils/job-url.util';
import { TasteService } from '../taste/taste.service';

@Injectable()
export class JobsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly events: EventsService,
    // Optional so the jobs list works in tests and tools without the taste model.
    @Optional() private readonly taste?: TasteService,
  ) {}

  // Rows left in APPLYING by a crash go back to the queue.
  onApplicationBootstrap(): void {
    const { changes } = this.storage.run('UPDATE jobs SET status = ?, updated_at = ? WHERE status = ?', [
      JobStatus.APPROVED,
      new Date().toISOString(),
      JobStatus.APPLYING,
    ]);
    if (changes > 0) this.logger.warn(`Re-queued ${changes} application(s) interrupted by the last shutdown`);
    const merged = this.mergeSameRoles();
    if (merged > 0) this.logger.log(`Merged ${merged} duplicate listing(s) of the same job`);
  }

  /**
   * One card per role: copies of a job found in the last 30 days (same company and title) are
   * dismissed in favour of the one furthest along - applied first, then queued, then the best score.
   * Only copies still waiting (new, review, queued, skipped) are touched; you can approve them again.
   */
  mergeSameRoles(): number {
    const since = new Date(Date.now() - SAME_ROLE_WINDOW_DAYS * 86_400_000).toISOString();
    const rows = this.storage.all<{ id: number; company: string; title: string; location: string; status: JobStatus; score: number | null }>(
      "SELECT id, company, title, location, status, score FROM jobs WHERE discovered_at >= ? AND trim(company) <> '' ORDER BY id",
      [since],
    );
    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = `${r.company.trim().toLowerCase()}|${roleKey(r.title)}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    const rank = (s: JobStatus) => MERGE_KEEP_ORDER.indexOf(s);
    const now = new Date().toISOString();
    let merged = 0;
    this.storage.transaction(() => {
      for (const group of groups.values()) {
        if (group.length < 2) continue;
        const keep = [...group].sort((a, b) => rank(a.status) - rank(b.status) || (b.score ?? 0) - (a.score ?? 0) || a.id - b.id)[0];
        let location = keep.location;
        for (const r of group) {
          if (r.id === keep.id || !MERGEABLE.includes(r.status)) continue;
          this.storage.run('UPDATE jobs SET status = ?, reason = ?, updated_at = ? WHERE id = ?', [
            JobStatus.DISMISSED,
            `Same job as #${keep.id} (another listing)`,
            now,
            r.id,
          ]);
          if (r.location && !location.toLowerCase().includes(r.location.toLowerCase())) location = `${location} / ${r.location}`.slice(0, 200);
          merged++;
        }
        if (location !== keep.location) this.storage.run('UPDATE jobs SET location = ? WHERE id = ?', [location, keep.id]);
      }
    });
    return merged;
  }

  /** Returns the ids of newly inserted rows only. */
  saveDiscovered(jobs: DiscoveredJob[], origin = 'search'): number[] {
    const now = new Date().toISOString();
    const inserted: number[] = [];
    this.storage.transaction(() => {
      for (const j of jobs) {
        const existing = this.storage.get<{ id: number; status: string }>('SELECT id, status FROM jobs WHERE source = ? AND external_id = ?', [
          j.source,
          j.externalId,
        ]);
        const salary = j.salaryMin || j.salaryMax ? { min: j.salaryMin ?? null, max: j.salaryMax ?? null } : parseSalary(j.salaryRaw ?? null);
        const skills = j.skills?.length ? j.skills : extractSkills(`${j.title}\n${j.description}`);
        if (existing) {
          // A later detail fetch may add a description the search card lacked.
          this.storage.run(
            `UPDATE jobs SET title = ?, company = COALESCE(NULLIF(?, ''), company), location = COALESCE(NULLIF(?, ''), location),
               description = CASE WHEN length(?) > length(description) THEN ? ELSE description END,
               skills = CASE WHEN length(?) > length(skills) THEN ? ELSE skills END,
               apply_url = COALESCE(?, apply_url), easy_apply = MAX(easy_apply, ?), updated_at = ?
             WHERE id = ?`,
            [
              j.title,
              j.company,
              j.location,
              j.description,
              j.description,
              JSON.stringify(skills),
              JSON.stringify(skills),
              j.applyUrl ?? null,
              j.easyApply ? 1 : 0,
              now,
              existing.id,
            ],
          );
          continue;
        }
        // The same role listed again - per city on LinkedIn, or on another job site - is one job.
        const same = this.sameRole(j.company, j.title, now);
        if (same) {
          const where = (j.location ?? '').trim();
          if (where && !same.location.toLowerCase().includes(where.toLowerCase())) {
            this.storage.run('UPDATE jobs SET location = ?, updated_at = ? WHERE id = ?', [`${same.location} / ${where}`.slice(0, 200), now, same.id]);
          }
          continue;
        }
        const res = this.storage.run(
          `INSERT INTO jobs (source, external_id, url, apply_url, title, company, location, is_remote, easy_apply,
             salary_raw, salary_min, salary_max, description, skills, posted_at, status, origin, discovered_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            j.source,
            j.externalId,
            j.url,
            j.applyUrl ?? null,
            j.title.slice(0, 300),
            j.company.slice(0, 200),
            j.location.slice(0, 200),
            j.isRemote || detectRemote(j.location, j.description) ? 1 : 0,
            j.easyApply ? 1 : 0,
            j.salaryRaw ?? null,
            salary.min,
            salary.max,
            j.description.slice(0, 20_000),
            JSON.stringify(skills),
            j.postedAt ?? null,
            JobStatus.NEW,
            origin,
            now,
            now,
          ],
        );
        inserted.push(res.lastInsertRowid);
      }
    });
    return inserted;
  }

  /** A job found recently with the same company and title (ignoring case, spaces and punctuation). */
  private sameRole(company: string, title: string, now: string): { id: number; location: string } | null {
    const key = roleKey(title);
    if (!company.trim() || !key) return null;
    const since = new Date(Date.parse(now) - SAME_ROLE_WINDOW_DAYS * 86_400_000).toISOString();
    const rows = this.storage.all<{ id: number; title: string; location: string }>(
      'SELECT id, title, location FROM jobs WHERE lower(trim(company)) = lower(trim(?)) AND discovered_at >= ? ORDER BY id',
      [company, since],
    );
    return rows.find((r) => roleKey(r.title) === key) ?? null;
  }

  knownExternalIds(source: JobSource, externalIds: string[]): Set<string> {
    if (externalIds.length === 0) return new Set();
    const rows = this.storage.all<{ external_id: string }>(
      `SELECT external_id FROM jobs WHERE source = ? AND external_id IN (${externalIds.map(() => '?').join(',')})`,
      [source, ...externalIds],
    );
    return new Set(rows.map((r) => r.external_id));
  }

  // User-supplied links skip review.
  addLinks(links: JobLinkDto[]): { added: number; duplicates: number; invalid: string[] } {
    const invalid: string[] = [];
    const jobs: DiscoveredJob[] = [];
    for (const link of links) {
      const parsed = parseJobUrl(link.url);
      if (!parsed) {
        invalid.push(link.url);
        continue;
      }
      jobs.push({
        source: parsed.source,
        externalId: parsed.externalId,
        url: parsed.url,
        title: link.title?.trim() || 'Job from your list',
        company: link.company?.trim() || (parsed.source === JobSource.WEB ? new URL(parsed.url).hostname.replace(/^www\./, '') : ''),
        location: '',
        isRemote: false,
        easyApply: false,
        description: link.notes ?? '',
      });
    }
    const ids = this.saveDiscovered(jobs, 'link');
    if (ids.length > 0) {
      this.setStatusMany(ids, JobStatus.APPROVED, 'Added from your job list');
    }
    return { added: ids.length, duplicates: jobs.length - ids.length, invalid };
  }

  get(id: number): Job {
    const row = this.storage.get<JobRow>('SELECT * FROM jobs WHERE id = ?', [id]);
    if (!row) throw new NotFoundException(`Job ${id} not found`);
    return toJob(row);
  }

  list(q: ListJobsQueryDto): JobList {
    const where: string[] = [];
    const params: SQLInputValue[] = [];
    if (q.status?.length) {
      where.push(`status IN (${q.status.map(() => '?').join(',')})`);
      params.push(...q.status);
    }
    if (q.source) {
      where.push('source = ?');
      params.push(q.source);
    }
    if (q.search) {
      where.push('(title LIKE ? OR company LIKE ?)');
      params.push(`%${q.search}%`, `%${q.search}%`);
    }
    if (q.minScore !== undefined) {
      where.push('score >= ?');
      params.push(q.minScore);
    }
    // Counts per platform use every filter except the platform itself.
    const base = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const platforms: Record<string, number> = {};
    for (const r of this.storage.all<{ p: string; n: number }>(`SELECT ${PLATFORM_SQL} p, COUNT(*) n FROM jobs ${base} GROUP BY p`, params)) {
      platforms[r.p] = Number(r.n);
    }
    if (q.platform) {
      where.push(`${PLATFORM_SQL} = ?`);
      params.push(q.platform);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const order =
      q.sort === 'recent'
        ? 'updated_at DESC'
        : q.sort === 'applied'
          ? 'applied_at DESC'
          : q.sort === 'taste'
            ? 'COALESCE(taste, -1) DESC, COALESCE(score, -1) DESC'
            : 'COALESCE(score, -1) DESC, discovered_at DESC';
    const limit = q.limit ?? 50;
    const offset = ((q.page ?? 1) - 1) * limit;
    const total = this.storage.get<{ n: number }>(`SELECT COUNT(*) n FROM jobs ${clause}`, params)?.n ?? 0;
    const rows = this.storage.all<JobRow>(`SELECT * FROM jobs ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return { items: rows.map(toJob), total: Number(total), page: q.page ?? 1, limit, platforms };
  }

  unscored(limit: number): Job[] {
    return this.storage.all<JobRow>('SELECT * FROM jobs WHERE status = ? ORDER BY discovered_at LIMIT ?', [JobStatus.NEW, limit]).map(toJob);
  }

  nextToApply(platforms: JobPlatform[]): Job | null {
    if (platforms.length === 0) return null;
    const row = this.storage.get<JobRow>(
      `SELECT * FROM jobs WHERE status = ? AND ${PLATFORM_SQL} IN (${platforms.map(() => '?').join(',')})
       ORDER BY (origin = 'link') DESC, COALESCE(score, 0) DESC, discovered_at LIMIT 1`,
      [JobStatus.APPROVED, ...platforms],
    );
    return row ? toJob(row) : null;
  }

  skippedBreakdown(): { rule: string; count: number }[] {
    return this.storage
      .all<{ rule: string | null; n: number }>(
        `SELECT json_extract(score_detail, '$.skipRule') rule, COUNT(*) n FROM jobs
         WHERE status = ? GROUP BY rule ORDER BY n DESC`,
        [JobStatus.SKIPPED],
      )
      .map((r) => ({ rule: r.rule ?? 'other', count: Number(r.n) }));
  }

  countByStatus(status: JobStatus): number {
    return Number(this.storage.get<{ n: number }>('SELECT COUNT(*) n FROM jobs WHERE status = ?', [status])?.n ?? 0);
  }

  queuedCount(): number {
    return Number(this.storage.get<{ n: number }>('SELECT COUNT(*) n FROM jobs WHERE status = ?', [JobStatus.APPROVED])?.n ?? 0);
  }

  isAlreadyApplied(company: string, title: string): boolean {
    return !!this.storage.get('SELECT 1 FROM jobs WHERE status = ? AND lower(company) = lower(?) AND lower(title) = lower(?) LIMIT 1', [
      JobStatus.APPLIED,
      company,
      title,
    ]);
  }

  setScore(id: number, score: number, detail: ScoreDetail, status: JobStatus, reason: string): void {
    this.storage.run('UPDATE jobs SET score = ?, score_detail = ?, status = ?, reason = ?, updated_at = ? WHERE id = ?', [
      score,
      JSON.stringify(detail),
      status,
      reason,
      new Date().toISOString(),
      id,
    ]);
    this.emitUpdate(id);
  }

  setStatus(id: number, status: JobStatus, reason?: string | null): Job {
    const now = new Date().toISOString();
    this.storage.run(
      `UPDATE jobs SET status = ?, reason = COALESCE(?, reason), updated_at = ?,
         applied_at = CASE WHEN ? = 'applied' THEN ? ELSE applied_at END,
         attempts = attempts + CASE WHEN ? = 'applying' THEN 1 ELSE 0 END
       WHERE id = ?`,
      [status, reason ?? null, now, status, now, status, id],
    );
    this.emitUpdate(id);
    return this.get(id);
  }

  /** The last try did not count (the site refused it for now): one try back. */
  forgetAttempt(id: number): void {
    this.storage.run('UPDATE jobs SET attempts = MAX(0, attempts - 1) WHERE id = ?', [id]);
  }

  /** Jobs from one site, by the site's own job id (Indeed's "jk"), with when Sudarshan last tried each. */
  byExternalIds(
    source: JobSource,
    ids: string[],
  ): { id: number; title: string; company: string; status: JobStatus; lastAttempt: string | null; discoveredAt: string }[] {
    if (ids.length === 0) return [];
    return this.storage.all(
      `SELECT id, title, company, status, discovered_at AS discoveredAt,
         (SELECT MAX(started_at) FROM attempts a WHERE a.job_id = jobs.id) AS lastAttempt
       FROM jobs WHERE source = ? AND lower(external_id) IN (${ids.map(() => '?').join(',')})`,
      [source, ...ids.map((i) => i.toLowerCase())],
    );
  }

  /**
   * Applied, as the site itself confirms, at `at` - when it most likely happened, not now - so an old
   * application does not use up today's daily limit. Returns false if it was already applied.
   */
  markAppliedAt(id: number, reason: string, at: string): boolean {
    const { changes } = this.storage.run('UPDATE jobs SET status = ?, reason = ?, applied_at = ?, updated_at = ? WHERE id = ? AND status <> ?', [
      JobStatus.APPLIED,
      reason,
      at,
      new Date().toISOString(),
      id,
      JobStatus.APPLIED,
    ]);
    if (changes) this.emitUpdate(id);
    return changes > 0;
  }

  /** Approves every job in Review scoring at least `minScore` (optionally on one platform) - all pages, not just the one shown. */
  approveStrong(minScore: number, platform?: JobPlatform): number {
    const ids = this.storage
      .all<{ id: number }>(`SELECT id FROM jobs WHERE status = ? AND score >= ?${platform ? ` AND ${PLATFORM_SQL} = ?` : ''}`, [
        JobStatus.REVIEW,
        minScore,
        ...(platform ? [platform] : []),
      ])
      .map((r) => r.id);
    return this.setStatusMany(ids, JobStatus.APPROVED, 'Approved by you', [JobStatus.REVIEW], true);
  }

  /** "I applied": counted as applied, and as your decision for the taste model. */
  markAppliedByYou(id: number): Job {
    this.storage.run('UPDATE jobs SET user_decided = 1 WHERE id = ?', [id]);
    const job = this.setStatus(id, JobStatus.APPLIED, 'Marked applied by you');
    this.taste?.refreshSoon();
    return job;
  }

  /** When `from` is given, only jobs currently in one of those statuses move. `byUser` marks it as your decision, which rescoring never overrides. */
  setStatusMany(ids: number[], status: JobStatus, reason?: string, from?: JobStatus[], byUser = false): number {
    if (ids.length === 0) return 0;
    const now = new Date().toISOString();
    const fromClause = from?.length ? ` AND status IN (${from.map(() => '?').join(',')})` : '';
    const { changes } = this.storage.run(
      `UPDATE jobs SET status = ?, reason = COALESCE(?, reason), updated_at = ?${byUser ? ', user_decided = 1' : ''}${byUser && status === JobStatus.APPROVED ? ', attempts = 0' : ''} WHERE id IN (${ids.map(() => '?').join(',')})${fromClause}`,
      [status, reason ?? null, now, ...ids, ...(from ?? [])],
    );
    this.events.emit({ type: AgentEventType.JOB_UPDATED, message: `${changes} job(s) -> ${status}`, data: { ids, status } });
    // Your decisions teach the taste model.
    if (byUser && changes) this.taste?.refreshSoon();
    return changes;
  }

  /** Sends the agent's own Review and Skipped decisions back for scoring; jobs you moved yourself stay put. */
  resetForRescore(): number {
    return this.storage.run('UPDATE jobs SET status = ?, updated_at = ? WHERE status IN (?, ?) AND user_decided = 0', [
      JobStatus.NEW,
      new Date().toISOString(),
      JobStatus.REVIEW,
      JobStatus.SKIPPED,
    ]).changes;
  }

  queuedOn(platform: JobPlatform): number {
    return Number(
      this.storage.get<{ n: number }>(`SELECT COUNT(*) n FROM jobs WHERE status = ? AND ${PLATFORM_SQL} = ?`, [JobStatus.APPROVED, platform])?.n ?? 0,
    );
  }

  appliedToday(platform?: JobPlatform): number {
    const since = localDayStartIso();
    const row = platform
      ? this.storage.get<{ n: number }>(`SELECT COUNT(*) n FROM jobs WHERE status = ? AND applied_at >= ? AND ${PLATFORM_SQL} = ?`, [
          JobStatus.APPLIED,
          since,
          platform,
        ])
      : this.storage.get<{ n: number }>('SELECT COUNT(*) n FROM jobs WHERE status = ? AND applied_at >= ?', [JobStatus.APPLIED, since]);
    return Number(row?.n ?? 0);
  }

  startAttempt(jobId: number): number {
    return this.storage.run('INSERT INTO attempts (job_id, started_at) VALUES (?, ?)', [jobId, new Date().toISOString()]).lastInsertRowid;
  }

  /** `result` is how the attempt ended in detail (e.g. "run:stuck", "prep:no_apply_button"), used for platform health. */
  finishAttempt(
    attemptId: number,
    outcome: string,
    detail: string | null,
    stats: AttemptStats,
    trace: string[],
    screenshot: string | null,
    result: string | null = null,
  ): void {
    const started = this.storage.get<{ started_at: string }>('SELECT started_at FROM attempts WHERE id = ?', [attemptId]);
    const now = new Date();
    this.storage.run(
      `UPDATE attempts SET finished_at = ?, outcome = ?, detail = ?, steps = ?, fields = ?, llm_calls = ?, memory_hits = ?,
         duration_ms = ?, screenshot = ?, trace = ?, result = ? WHERE id = ?`,
      [
        now.toISOString(),
        outcome,
        detail,
        stats.steps,
        stats.fields,
        stats.llmCalls,
        stats.memoryHits,
        started ? now.getTime() - new Date(started.started_at).getTime() : null,
        screenshot,
        JSON.stringify(trace.slice(-200)),
        result,
        attemptId,
      ],
    );
  }

  attempts(jobId: number): Attempt[] {
    return this.storage.all<AttemptRow>('SELECT * FROM attempts WHERE job_id = ? ORDER BY id DESC', [jobId]).map(toAttempt);
  }

  stats(): JobStats {
    const byStatus: Record<string, number> = {};
    for (const r of this.storage.all<{ status: string; n: number }>('SELECT status, COUNT(*) n FROM jobs GROUP BY status')) {
      byStatus[r.status] = Number(r.n);
    }
    const since = localDayStartIso();
    const appliedTodayBySource: Record<string, number> = {};
    for (const r of this.storage.all<{ source: string; n: number }>(
      'SELECT source, COUNT(*) n FROM jobs WHERE status = ? AND applied_at >= ? GROUP BY source',
      [JobStatus.APPLIED, since],
    )) {
      appliedTodayBySource[r.source] = Number(r.n);
    }
    const appliedTodayByPlatform: Record<string, number> = {};
    for (const r of this.storage.all<{ p: string; n: number }>(
      `SELECT ${PLATFORM_SQL} p, COUNT(*) n FROM jobs WHERE status = ? AND applied_at >= ? GROUP BY p`,
      [JobStatus.APPLIED, since],
    )) {
      appliedTodayByPlatform[r.p] = Number(r.n);
    }
    const queuedByPlatform: Record<string, number> = {};
    for (const r of this.storage.all<{ p: string; n: number }>(`SELECT ${PLATFORM_SQL} p, COUNT(*) n FROM jobs WHERE status = ? GROUP BY p`, [
      JobStatus.APPROVED,
    ])) {
      queuedByPlatform[r.p] = Number(r.n);
    }
    const recent = this.storage.all<{ duration_ms: number; fields: number; memory_hits: number }>(
      `SELECT duration_ms, fields, memory_hits FROM attempts WHERE outcome = 'applied' AND duration_ms IS NOT NULL ORDER BY id DESC LIMIT 50`,
    );
    const durations = recent.map((r) => Number(r.duration_ms)).sort((a, b) => a - b);
    const fields = recent.reduce((s, r) => s + Number(r.fields), 0);
    const hits = recent.reduce((s, r) => s + Number(r.memory_hits), 0);
    return {
      byStatus,
      appliedToday: Object.values(appliedTodayBySource).reduce((a, b) => a + b, 0),
      appliedTodayBySource,
      appliedTodayByPlatform,
      queuedByPlatform,
      appliedTotal: byStatus[JobStatus.APPLIED] ?? 0,
      medianApplySeconds: durations.length ? Math.round(durations[Math.floor(durations.length / 2)] / 1000) : null,
      memoryHitRate: fields > 0 ? Math.round((hits / fields) * 100) / 100 : null,
    };
  }

  private emitUpdate(id: number): void {
    const job = this.get(id);
    this.events.emit({
      type: AgentEventType.JOB_UPDATED,
      message: `${job.title} @ ${job.company} -> ${job.status}`,
      jobId: id,
      data: { status: job.status, score: job.score, reason: job.reason },
    });
  }
}
