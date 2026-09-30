// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { JobSource } from '../jobs/enums/job-source.enum';
import { platformOf } from '../jobs/utils/platform.util';
import { LOGISTIC, MIN_EXAMPLES, OUTCOME_MIN_AUC, OUTCOME_MIN_TESTED } from './constants/learners.constants';
import { LearnerMode } from './enums/learner-mode.enum';
import { LearnerName } from './enums/learner-name.enum';
import { LearnersService } from './learners.service';
import { auc, predictLogistic, trainLogistic } from './utils/logistic.util';
import { metricsOf } from './utils/mode.util';
import { AttemptShape, HostStats, outcomeFeatures } from './utils/outcome-features.util';

const L = LearnerName.OUTCOME;
/** Went through on its own. */
const SUCCESS = ['prep:applied', 'run:applied'];
/** Needed you, or failed. Closed jobs, already-applied, refusals and careful mode say nothing about the attempt. */
const FAILURE = [
  'run:stuck',
  'error',
  'prep:no_apply_button',
  'prep:login_required',
  'prep:captcha',
  'run:captcha',
  'run:closed',
  'run:needs_input',
  'run:blocked',
];

interface Row {
  id: number;
  result: string;
  source: string;
  url: string;
  apply_url: string | null;
  easy_apply: number;
  score: number | null;
}

const hostOf = (url: string | null) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
};

/**
 * Learns which applications go through without you, from every attempt so far (platform, Easy Apply
 * or company site, how that site went before, the job's fit). Switched on, it only reorders the queue
 * within the same score band - likely successes first, jobs that will need you later - never skips.
 * Measured the honest way: trained on older attempts, tested on the newest.
 */
@Injectable()
export class OutcomeLearnerService {
  private readonly logger = new Logger(OutcomeLearnerService.name);

  constructor(
    private readonly learners: LearnersService,
    private readonly storage: StorageService,
  ) {}

  train(): void {
    const rows = this.storage.all<Row>(
      `SELECT a.id, a.result, j.source, j.url, j.apply_url, j.easy_apply, j.score FROM attempts a JOIN jobs j ON j.id = a.job_id
       WHERE a.result IN (${[...SUCCESS, ...FAILURE].map(() => '?').join(',')}) ORDER BY a.id`,
      [...SUCCESS, ...FAILURE],
    );
    const shape = (r: Row): AttemptShape => {
      const platform = platformOf(r.source as JobSource, r.url, r.apply_url);
      const host = hostOf(r.apply_url) || hostOf(r.url);
      return { platform, easyApply: r.easy_apply === 1, host, external: !!r.apply_url && host !== hostOf(r.url), score: r.score };
    };
    const y = (r: Row): 0 | 1 => (SUCCESS.includes(r.result) ? 1 : 0);
    const statsOf = (rs: Row[]): HostStats => {
      const m: HostStats = new Map();
      for (const r of rs) {
        const h = shape(r).host;
        const s = m.get(h) ?? { ok: 0, n: 0 };
        s.n++;
        s.ok += y(r);
        m.set(h, s);
      }
      return m;
    };

    // Trained on the older 80%, tested on the newest 20% it had not seen.
    const cut = Math.floor(rows.length * 0.8);
    const past = rows.slice(0, cut);
    const recent = rows.slice(cut);
    const pastStats = statsOf(past);
    const model = trainLogistic(
      past.map((r) => ({ x: outcomeFeatures(shape(r), pastStats), y: y(r) })),
      LOGISTIC,
    );
    const a = auc(recent.map((r) => ({ y: y(r), p: predictLogistic(model, outcomeFeatures(shape(r), pastStats)) })));
    const tested = recent.length;
    const enabled = this.learners.enabled(L);
    const mode = !enabled
      ? LearnerMode.OFF
      : rows.length < MIN_EXAMPLES[L]
        ? LearnerMode.LEARNING
        : a !== null && a >= OUTCOME_MIN_AUC && tested >= OUTCOME_MIN_TESTED
          ? LearnerMode.ON
          : LearnerMode.CHECKING;
    // Its "accuracy" is how often it ranks a success above a failure among the newest attempts.
    const offline = a === null ? null : { ...metricsOf(tested, Math.round(a * tested), 'the newest attempts, ranked'), accuracy: Math.round(a * 1000) / 1000 };

    // Switched on: every queued job gets its chance, from the whole history; otherwise none.
    if (mode === LearnerMode.ON) {
      const all = statsOf(rows);
      const full = trainLogistic(
        rows.map((r) => ({ x: outcomeFeatures(shape(r), all), y: y(r) })),
        LOGISTIC,
      );
      const queued = this.storage.all<Omit<Row, 'result'>>(`SELECT id, source, url, apply_url, easy_apply, score FROM jobs WHERE status = 'approved'`);
      this.storage.transaction(() => {
        for (const j of queued) {
          const p = predictLogistic(full, outcomeFeatures(shape({ ...j, result: '' }), all));
          this.storage.run('UPDATE jobs SET success_chance = ? WHERE id = ?', [Math.round(p * 100) / 100, j.id]);
        }
      });
    } else {
      this.storage.run('UPDATE jobs SET success_chance = NULL WHERE success_chance IS NOT NULL');
    }
    const pct = a === null ? '-' : `${Math.round(a * 100)}%`;
    const note =
      mode === LearnerMode.ON
        ? `Puts likely successes first within each score band (ranks them right ${pct} of the time on the newest attempts)`
        : mode === LearnerMode.CHECKING
          ? `Checking itself - ranks the newest attempts right ${pct} of the time, needs ${Math.round(OUTCOME_MIN_AUC * 100)}%`
          : mode === LearnerMode.LEARNING
            ? `Collecting examples (${rows.length} of ${MIN_EXAMPLES[L]} attempts)`
            : 'Switched off';
    this.learners.saveState(L, { mode, offline, examples: rows.length, note });
    this.logger.log(`Outcome learner: ${rows.length} attempts, ${note}`);
  }
}
