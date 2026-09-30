// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger } from '@nestjs/common';
import { cosine } from '../../common/embeddings/utils/vector.util';
import { PastAnswersService } from '../answers/past-answers.service';
import { DIFFERENT_BELOW, LOGISTIC, MIN_EXAMPLES } from './constants/learners.constants';
import { LearnerMode } from './enums/learner-mode.enum';
import { LearnerName } from './enums/learner-name.enum';
import { LogisticModel, LogisticSample } from './interfaces/logistic-model.interface';
import { LearnersService } from './learners.service';
import { auc, predictLogistic, trainLogistic } from './utils/logistic.util';
import { decideMode, metricsOf } from './utils/mode.util';
import { pairFeatures, sameReply } from './utils/pair-features.util';

const L = LearnerName.QUESTION;
/** Pairs looked at per saved answer: its closest few in meaning. */
const NEIGHBOURS = 8;
const MIN_PAIR_SIMILARITY = 0.5;

/**
 * Learns which similar-looking questions are really the same, from your saved answers: two questions
 * you answered the same way ("30" / "30 days") are the same; different replies mean different questions
 * ("current CTC" 12 vs "expected CTC" 18). Used to keep past answers about something else away from
 * the AI - only once it is right about that at least 95% of the time on pairs it had not seen.
 */
@Injectable()
export class QuestionLearnerService {
  private readonly logger = new Logger(QuestionLearnerService.name);
  private model: LogisticModel | null = null;

  constructor(
    private readonly learners: LearnersService,
    private readonly pastAnswers: PastAnswersService,
  ) {}

  mode(): LearnerMode {
    return this.learners.mode(L);
  }

  /** Chance the two questions ask the same thing; null before it has learned anything. */
  same(asked: string, saved: string, similarity: number): number | null {
    return this.model ? predictLogistic(this.model, pairFeatures(asked, saved, similarity)) : null;
  }

  /** Keep this past answer for the AI? Always, unless switched on and sure it is about something else. */
  keep(asked: string, saved: string, similarity: number): boolean {
    if (this.mode() !== LearnerMode.ON) return true;
    const p = this.same(asked, saved, similarity);
    return p === null || p >= DIFFERENT_BELOW;
  }

  async train(): Promise<void> {
    const rows = await this.pastAnswers.trusted();
    if (!rows) return;
    // Pairs of your saved questions close in meaning, labelled by whether you answered them the same way.
    const pairs: { group: number; s: LogisticSample; similarity: number }[] = [];
    rows.forEach((a, i) => {
      rows
        .map((b, j) => ({ b, j, sim: j === i ? -1 : cosine(a.vector, b.vector) }))
        .filter((x) => x.sim >= MIN_PAIR_SIMILARITY)
        .sort((x, y) => y.sim - x.sim)
        .slice(0, NEIGHBOURS)
        .forEach(({ b, sim }) => {
          const y = sameReply(a.answer, b.answer);
          if (y !== null) pairs.push({ group: i, similarity: sim, s: { x: pairFeatures(a.question, b.question, sim), y: y ? 1 : 0 } });
        });
    });

    // Measured on answers it had not seen (5 folds, by answer): of the past answers it would hide, how many really were different.
    let dropped = 0;
    let rightDrops = 0;
    const scored: { y: 0 | 1; p: number }[] = [];
    const byCosine: { y: 0 | 1; p: number }[] = [];
    for (let fold = 0; fold < 5; fold++) {
      const m = trainLogistic(
        pairs.filter((p) => p.group % 5 !== fold).map((p) => p.s),
        LOGISTIC,
      );
      for (const p of pairs.filter((q) => q.group % 5 === fold)) {
        const prob = predictLogistic(m, p.s.x);
        scored.push({ y: p.s.y, p: prob });
        byCosine.push({ y: p.s.y, p: p.similarity });
        if (prob < DIFFERENT_BELOW) {
          dropped++;
          if (p.s.y === 0) rightDrops++;
        }
      }
    }
    this.model = pairs.length
      ? trainLogistic(
          pairs.map((p) => p.s),
          LOGISTIC,
        )
      : null;
    const offline = metricsOf(dropped, rightDrops, 'pairs of your answers it had not seen');
    const mode = decideMode({ enabled: this.learners.enabled(L), examples: pairs.length, min: MIN_EXAMPLES[L], offline, live: null });
    const a = auc(scored);
    const c = auc(byCosine);
    const note =
      mode === LearnerMode.ON
        ? `Hides past answers about something else - right ${rightDrops} of ${dropped} times`
        : mode === LearnerMode.CHECKING
          ? `Checking itself (would hide ${dropped}, ${rightDrops} rightly); tells same from different ${a !== null && c !== null ? `${Math.round(a * 100)}% vs ${Math.round(c * 100)}% by meaning alone` : ''}`.trim()
          : mode === LearnerMode.LEARNING
            ? `Collecting examples (${pairs.length} of ${MIN_EXAMPLES[L]} pairs)`
            : 'Switched off';
    this.learners.saveState(L, { mode, offline, examples: pairs.length, note });
    this.logger.log(`Question learner: ${pairs.length} pairs, ${note}`);
  }
}
