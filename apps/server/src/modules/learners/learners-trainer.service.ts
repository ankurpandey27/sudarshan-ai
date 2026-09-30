// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { TRAIN_EVERY_MS, TRAIN_SOON_MS } from './constants/learners.constants';
import { ButtonLearnerService } from './button-learner.service';
import { FieldLearnerService } from './field-learner.service';
import { OutcomeLearnerService } from './outcome-learner.service';
import { QuestionLearnerService } from './question-learner.service';

/**
 * Retrains every learner from what happened since: at start (in the background) and every few hours.
 * One learner failing never stops the others, or anything else.
 */
@Injectable()
export class LearnersTrainerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(LearnersTrainerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private soon: NodeJS.Timeout | null = null;

  constructor(
    private readonly field: FieldLearnerService,
    private readonly question: QuestionLearnerService,
    private readonly button: ButtonLearnerService,
    private readonly outcome: OutcomeLearnerService,
  ) {}

  onApplicationBootstrap(): void {
    void this.trainAll();
    this.timer = setInterval(() => void this.trainAll(), TRAIN_EVERY_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.soon) clearTimeout(this.soon);
  }

  /** Something worth learning just happened (a rescued application went through): retrain in a minute, once. */
  trainSoon(): void {
    if (this.soon) clearTimeout(this.soon);
    this.soon = setTimeout(() => void this.trainAll(), TRAIN_SOON_MS);
    this.soon.unref();
  }

  /** Trains all learners once; a second call while one runs waits for it. */
  trainAll(): Promise<void> {
    this.running ??= this.run().finally(() => (this.running = null));
    return this.running;
  }

  private async run(): Promise<void> {
    const steps: [string, () => unknown][] = [
      ['field', () => this.field.train()],
      ['question', () => this.question.train()],
      ['button', () => this.button.train()],
      ['outcome', () => this.outcome.train()],
    ];
    for (const [name, train] of steps) {
      try {
        await train();
      } catch (err) {
        this.logger.warn(`The ${name} learner could not train: ${(err as Error).message}`);
      }
    }
  }
}
