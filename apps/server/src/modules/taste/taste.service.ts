// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { JobSource } from '../jobs/enums/job-source.enum';
import { platformOf } from '../jobs/utils/platform.util';
import { MIN_KEPT, REFRESH_DEBOUNCE_MS, REFRESH_AFTER_START_MS, REFRESH_EVERY_MS, UNWANTED_STATUSES, WANTED_STATUSES } from './constants/taste.constants';
import { InterestProfile, TasteFeaturesInput, TastePrediction, TasteState } from './interfaces/taste.interface';
import { habitsOf } from './utils/habits.util';
import { buildProfile, interestOf } from './utils/interest.util';

interface JobRowForTaste {
  id: number;
  title: string;
  source: string;
  url: string;
  apply_url: string | null;
  is_remote: number;
  easy_apply: number;
  score: number | null;
  score_detail: string | null;
  status: string;
  user_decided: number;
  reason: string | null;
}

const inList = (xs: string[]) => xs.map((x) => `'${x}'`).join(', ');

/**
 * Your interest, learned from your own decisions on this computer: what the jobs you applied to or
 * approved have in common (skills first, then titles and platforms), and what you really turn down.
 * Each job gets how much it looks like the ones you apply to. It ranks and explains; it never
 * replaces your rules.
 */
@Injectable()
export class TasteService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TasteService.name);
  private profile: InterestProfile | null = null;
  private trainedOn = '';
  private current: TasteState = {
    status: 'learning',
    decisions: 0,
    wanted: 0,
    unwanted: 0,
    needed: MIN_KEPT,
    accuracy: null,
    likes: [],
    dislikes: [],
    trainedAt: null,
  };
  private timer: NodeJS.Timeout | null = null;
  private soon: NodeJS.Timeout | null = null;

  constructor(private readonly storage: StorageService) {}

  onApplicationBootstrap(): void {
    // After the server is up: it ran before the app could answer (2026-10-08).
    this.soon = setTimeout(() => this.refresh(), REFRESH_AFTER_START_MS);
    this.soon.unref();
    this.timer = setInterval(() => this.refresh(), REFRESH_EVERY_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.soon) clearTimeout(this.soon);
  }

  state(): TasteState {
    return this.current;
  }

  /** After you approve or skip jobs: retrain shortly, once, however many you changed. */
  refreshSoon(): void {
    if (this.soon) clearTimeout(this.soon);
    this.soon = setTimeout(() => this.refresh(), REFRESH_DEBOUNCE_MS);
    this.soon.unref();
  }

  /** Retrains when your decisions changed, then updates every open job's taste score. */
  refresh(): TasteState {
    try {
      const rows = this.decided();
      const key = rows.map((r) => `${r.id}:${r.y}`).join(',');
      const changed = key !== this.trainedOn;
      if (changed) {
        this.trainedOn = key;
        this.train(rows);
      }
      // A new model re-scores every open job; otherwise only jobs that have no score yet.
      this.scoreOpenJobs(changed);
    } catch (err) {
      this.logger.warn(`Taste model skipped: ${(err as Error).message}`);
    }
    return this.current;
  }

  /** Your interest in a job, with reasons; null until you have kept enough jobs. */
  predict(job: TasteFeaturesInput): TastePrediction | null {
    return this.profile ? interestOf(this.profile, job) : null;
  }

  private decided(): { id: number; y: 0 | 1; job: TasteFeaturesInput }[] {
    const rows = this.storage.all<JobRowForTaste>(
      `SELECT id, title, source, url, apply_url, is_remote, easy_apply, score, score_detail, status, user_decided, reason FROM jobs
       WHERE (user_decided = 1 AND status IN (${inList([...WANTED_STATUSES, ...UNWANTED_STATUSES])}))
          OR reason = 'Marked applied by you' OR reason LIKE 'Finished by you%'
       ORDER BY id`,
    );
    return rows.map((r) => ({ id: r.id, y: UNWANTED_STATUSES.includes(r.status) ? 0 : 1, job: this.input(r) }));
  }

  private input(r: JobRowForTaste): TasteFeaturesInput {
    return {
      title: r.title,
      platform: platformOf(r.source as JobSource, r.url, r.apply_url),
      isRemote: r.is_remote === 1,
      easyApply: r.easy_apply === 1,
      score: r.score,
      detail: r.score_detail ? (JSON.parse(r.score_detail) as TasteFeaturesInput['detail']) : null,
    };
  }

  private train(rows: { y: 0 | 1; job: TasteFeaturesInput }[]): void {
    const wanted = rows.filter((r) => r.y === 1).length;
    const unwanted = rows.length - wanted;
    // What you keep is what you like: skips are optional (you may rarely skip anything).
    const needed = Math.max(0, MIN_KEPT - wanted);
    const base = { decisions: rows.length, wanted, unwanted, needed };
    if (needed > 0) {
      this.profile = null;
      this.current = { ...base, status: 'learning', accuracy: null, likes: [], dislikes: [], trainedAt: null };
      return;
    }
    this.profile = buildProfile(rows);
    this.current = {
      ...base,
      status: 'ready',
      accuracy: this.accuracy(rows),
      // Counted from what you did.
      ...habitsOf(rows),
      trainedAt: new Date().toISOString(),
    };
    this.logger.log(`Learned your interest from ${wanted} job(s) you kept and ${unwanted} you turned down`);
  }

  /** Honest check: build the profile from 4/5 of your decisions, test on the rest, five times over. */
  private accuracy(rows: { y: 0 | 1; job: TasteFeaturesInput }[]): number | null {
    if (rows.length < 30) return null;
    let right = 0;
    for (let fold = 0; fold < 5; fold++) {
      const profile = buildProfile(rows.filter((_, i) => i % 5 !== fold));
      right += rows.filter((r, i) => i % 5 === fold && interestOf(profile, r.job).p >= 0.5 === (r.y === 1)).length;
    }
    return Math.round((right / rows.length) * 100) / 100;
  }

  private scoreOpenJobs(all: boolean): void {
    if (!this.profile) {
      this.storage.run('UPDATE jobs SET taste = NULL, taste_reasons = NULL WHERE taste IS NOT NULL');
      return;
    }
    // Taste is shown and used only in Review and the queue; a new model leaves no stale scores elsewhere.
    if (all) this.storage.run(`UPDATE jobs SET taste = NULL, taste_reasons = NULL WHERE taste IS NOT NULL AND status NOT IN ('review', 'approved')`);
    const open = this.storage.all<JobRowForTaste>(
      `SELECT id, title, source, url, apply_url, is_remote, easy_apply, score, score_detail, status, user_decided, reason FROM jobs
       WHERE status IN ('review', 'approved') AND score IS NOT NULL${all ? '' : ' AND taste IS NULL'}`,
    );
    this.storage.transaction(() => {
      for (const row of open) {
        const taste = this.predict(this.input(row))!;
        this.storage.run('UPDATE jobs SET taste = ?, taste_reasons = ? WHERE id = ?', [Math.round(taste.p * 100) / 100, JSON.stringify(taste.reasons), row.id]);
      }
    });
  }
}
