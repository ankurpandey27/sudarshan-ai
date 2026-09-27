// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { JobSource } from '../jobs/enums/job-source.enum';
import { platformOf } from '../jobs/utils/platform.util';
import {
  GENERAL_FEATURES,
  L2,
  LEARNING_RATE,
  MIN_DECISIONS,
  MIN_EACH,
  MIN_WORD_COUNT,
  REFRESH_DEBOUNCE_MS,
  REFRESH_EVERY_MS,
  TRAIN_STEPS,
  UNWANTED_STATUSES,
  WANTED_STATUSES,
} from './constants/taste.constants';
import { TasteFeaturesInput, TasteModel, TastePrediction, TasteState } from './interfaces/taste.interface';
import { contributions, predictLogistic, Sample, trainLogistic } from './utils/logistic.util';
import { tasteFeatures, tasteWords } from './utils/taste-features.util';

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
 * Learns your taste from your own decisions - jobs you approved or marked applied versus jobs you
 * skipped or dismissed - with a small logistic regression that runs on this computer. It ranks
 * jobs for you and explains why; it never replaces your rules.
 */
@Injectable()
export class TasteService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TasteService.name);
  private model: TasteModel | null = null;
  private vocabulary = new Set<string>();
  private trainedOn = '';
  private current: TasteState = {
    status: 'learning',
    decisions: 0,
    wanted: 0,
    unwanted: 0,
    needed: MIN_DECISIONS,
    accuracy: null,
    likes: [],
    dislikes: [],
    trainedAt: null,
  };
  private timer: NodeJS.Timeout | null = null;
  private soon: NodeJS.Timeout | null = null;

  constructor(private readonly storage: StorageService) {}

  onApplicationBootstrap(): void {
    this.refresh();
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

  /** How likely you are to approve a job, with reasons; null until there are enough decisions. */
  predict(job: TasteFeaturesInput): TastePrediction | null {
    if (!this.model) return null;
    const x = tasteFeatures(job, this.vocabulary);
    const p = predictLogistic(this.model, x);
    // Say what sets this job apart (title words, platform, remote) before scores every job has.
    const all = contributions(this.model, x);
    const distinctive = all.filter((c) => !GENERAL_FEATURES.has(c.feature));
    const reasons = [...distinctive, ...all.filter((c) => GENERAL_FEATURES.has(c.feature))].slice(0, 3).map((c) => `${c.value > 0 ? '+' : '-'} ${c.feature}`);
    return { p, reasons };
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
    const needed = Math.max(0, MIN_DECISIONS - rows.length, MIN_EACH - wanted, MIN_EACH - unwanted);
    const base = { decisions: rows.length, wanted, unwanted, needed };
    if (needed > 0) {
      this.model = null;
      this.current = { ...base, status: 'learning', accuracy: null, likes: [], dislikes: [], trainedAt: null };
      return;
    }
    // Title words seen in only one job are noise.
    const counts = new Map<string, number>();
    for (const r of rows) for (const w of tasteWords(r.job.title)) counts.set(w, (counts.get(w) ?? 0) + 1);
    this.vocabulary = new Set([...counts].filter(([, n]) => n >= MIN_WORD_COUNT).map(([w]) => w));
    const samples: Sample[] = rows.map((r) => ({ x: tasteFeatures(r.job, this.vocabulary), y: r.y }));
    const opts = { steps: TRAIN_STEPS, rate: LEARNING_RATE, l2: L2 };
    this.model = trainLogistic(samples, opts);

    const ranked = Object.entries(this.model.weights)
      .filter(([k]) => k.startsWith('title: ') || k.startsWith('platform: ') || k === 'remote')
      .sort((a, b) => b[1] - a[1]);
    this.current = {
      ...base,
      status: 'ready',
      accuracy: this.accuracy(samples, opts),
      likes: ranked
        .filter(([, w]) => w > 0.15)
        .slice(0, 5)
        .map(([k]) => k),
      dislikes: ranked
        .filter(([, w]) => w < -0.15)
        .reverse()
        .slice(0, 5)
        .map(([k]) => k),
      trainedAt: new Date().toISOString(),
    };
    this.logger.log(`Taste model trained on ${rows.length} of your decisions`);
  }

  /** Honest check: train on 4/5 of the decisions, test on the rest, five times over. */
  private accuracy(samples: Sample[], opts: { steps: number; rate: number; l2: number }): number | null {
    if (samples.length < 30) return null;
    let right = 0;
    for (let fold = 0; fold < 5; fold++) {
      const test = samples.filter((_, i) => i % 5 === fold);
      const model = trainLogistic(
        samples.filter((_, i) => i % 5 !== fold),
        opts,
      );
      right += test.filter((s) => predictLogistic(model, s.x) >= 0.5 === (s.y === 1)).length;
    }
    return Math.round((right / samples.length) * 100) / 100;
  }

  private scoreOpenJobs(all: boolean): void {
    if (!this.model) {
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
      for (const r of open) {
        const t = this.predict(this.input(r))!;
        this.storage.run('UPDATE jobs SET taste = ?, taste_reasons = ? WHERE id = ?', [Math.round(t.p * 100) / 100, JSON.stringify(t.reasons), r.id]);
      }
    });
  }
}
