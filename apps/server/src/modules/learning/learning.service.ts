// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'puppeteer-core';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { AnswersService } from '../answers/answers.service';
import { AnswerSource } from '../answers/enums/answer-source.enum';
import { FieldKind } from '../form-engine/enums/field-kind.enum';
import { FormRunnerService } from '../form-engine/form-runner.service';
import { RecipesService } from '../form-engine/recipes.service';
import { FormSnapshot } from '../form-engine/interfaces/form-field.interface';
import { extractFormInPage } from '../form-engine/scripts/extract-form.script';
import { documentTextInPage } from '../form-engine/scripts/page-helpers.script';
import { JobsService } from '../jobs/jobs.service';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { CLICK_SETTLE_MS, SECRET_QUESTION } from './constants/learning.constants';
import { LearnEvent } from './interfaces/learn-event.interface';
import { LearningSession } from './interfaces/learning-session.interface';
import { WatchTarget } from './interfaces/watch-target.interface';
import { learnRecorderInPage } from './scripts/recorder.script';
import { formFingerprint, learnedSummary } from './utils/learning.util';

/**
 * Learning by demonstration. When the agent leaves a form to the user, it watches
 * the user finish it: every answer they give goes into answer memory and every
 * button that moves the form on becomes part of that site's recipe. The next
 * form with the same questions, on any site, fills itself.
 */
@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);
  private readonly watched = new WeakSet<Page>();

  constructor(
    private readonly runner: FormRunnerService,
    private readonly answers: AnswersService,
    private readonly recipes: RecipesService,
    private readonly jobs: JobsService,
    private readonly events: EventsService,
  ) {}

  async watch(page: Page, target: WatchTarget): Promise<void> {
    if (this.watched.has(page) || page.isClosed()) return;
    this.watched.add(page);
    const session: LearningSession = { known: new Map(), pending: null, answers: 0, steps: 0, done: false };
    try {
      // What is already filled (by the site or the agent) is not the user's answer.
      const start = await this.snapshot(page, target);
      for (const f of start.fields) if (f.value) session.known.set(f.label, f.value);

      await page.exposeFunction('__sudarshanLearn', (e: LearnEvent) => {
        if (session.done || !e.snap) return;
        this.learnStep(target, session, e.snap);
        this.learnAnswers(e.snap, session);
        if (e.type === 'click') this.onClick(page, target, session, e.text, e.snap);
      });
      // The extractor and recorder are re-added on every navigation, for multi-page forms.
      const setup = `window.__sudarshanExtract = ${extractFormInPage.toString()};
        window.__sudarshanScope = ${JSON.stringify(target.scopeSelector)};
        (${learnRecorderInPage.toString()})();`;
      await page.evaluateOnNewDocument(setup);
      await page.evaluate(setup);
      page.once('close', () => this.stop(target, session));
    } catch (err) {
      this.logger.debug(`Could not watch ${target.domain}: ${(err as Error).message}`);
    }
  }

  private async snapshot(page: Page, target: WatchTarget): Promise<FormSnapshot> {
    const inScope = target.scopeSelector ? await this.runner.snapshot(page, target.scopeSelector) : null;
    // A multi-page form may leave the dialog for a plain page.
    return inScope?.scopeFound ? inScope : this.runner.snapshot(page, null);
  }

  private learnAnswers(snap: FormSnapshot, session: LearningSession): void {
    for (const f of snap.fields) {
      const value = f.value.trim();
      if (!value || f.kind === FieldKind.FILE || !f.label || f.label.length < 3) continue;
      if (SECRET_QUESTION.test(`${f.label} ${f.name}`)) continue;
      if (session.known.get(f.label) === value) continue;
      session.known.set(f.label, value);
      if (this.answers.remember(f.label, value, AnswerSource.USER, f.kind)) session.answers++;
    }
  }

  private onClick(page: Page, target: WatchTarget, session: LearningSession, text: string, before: FormSnapshot): void {
    const action = before.actions.find((a) => a.text.trim().toLowerCase() === text.trim().toLowerCase());
    if (action && action.kind !== 'dismiss') {
      session.pending = { kind: action.kind === 'apply' ? 'apply' : 'advance', text: action.text, fingerprint: formFingerprint(before) };
    }
    // A final submit shows a confirmation instead of new questions.
    setTimeout(() => {
      if (session.done || page.isClosed()) return;
      void page
        .evaluate(documentTextInPage)
        .then((doc) => {
          if (!session.done && target.successPattern.test(doc)) this.complete(target, session);
        })
        .catch(() => undefined);
    }, CLICK_SETTLE_MS);
  }

  private learnStep(target: WatchTarget, session: LearningSession, now: FormSnapshot | null): void {
    const p = session.pending;
    if (!p || (now && formFingerprint(now) === p.fingerprint)) return;
    this.recipes.learn(target.domain, p.kind, p.text);
    session.steps++;
    session.pending = null;
  }

  private complete(target: WatchTarget, session: LearningSession): void {
    this.learnStep(target, session, null);
    session.done = true;
    this.jobs.setStatus(target.jobId, JobStatus.APPLIED, `Finished by you - learned ${learnedSummary(session)}`);
    this.recipes.outcome(target.domain, true);
    this.events.emit({
      type: AgentEventType.LOG,
      level: 'success',
      jobId: target.jobId,
      message: `${target.jobLabel}: you finished it - Sudarshan learned ${learnedSummary(session)} for next time`,
    });
  }

  private stop(target: WatchTarget, session: LearningSession): void {
    if (session.done) return;
    session.done = true;
    if (session.answers || session.steps) {
      this.events.emit({
        type: AgentEventType.LOG,
        level: 'info',
        jobId: target.jobId,
        message: `${target.jobLabel}: learned ${learnedSummary(session)} from you on ${target.domain}`,
      });
    }
  }
}
