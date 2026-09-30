// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger } from '@nestjs/common';
import { Frame, Page } from 'puppeteer-core';
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
import { CONFIRM_CHECKS_MS, SECRET_QUESTION } from './constants/learning.constants';
import { LearnEvent } from './interfaces/learn-event.interface';
import { LearningSession } from './interfaces/learning-session.interface';
import { WatchTarget } from './interfaces/watch-target.interface';
import { learnRecorderInPage } from './scripts/recorder.script';
import { formFingerprint, learnedSummary } from './utils/learning.util';
import { PlaybookService } from '../form-engine/playbook.service';
import { stepSignature } from '../form-engine/utils/step-signature.util';
import { CONFIRMED_WORLDWIDE } from '../form-engine/constants/form-runner.constants';

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
  private readonly sessions = new WeakMap<Page, LearningSession>();

  constructor(
    private readonly runner: FormRunnerService,
    private readonly answers: AnswersService,
    private readonly recipes: RecipesService,
    private readonly playbook: PlaybookService,
    private readonly jobs: JobsService,
    private readonly events: EventsService,
  ) {}

  async watch(page: Page, target: WatchTarget): Promise<void> {
    if (this.watched.has(page) || page.isClosed()) return;
    this.watched.add(page);
    const session: LearningSession = { known: new Map(), pending: null, moves: [], answers: 0, steps: 0, done: false };
    this.sessions.set(page, session);
    try {
      // What is already filled (by the site or the agent) is not the user's answer.
      const start = await this.snapshot(page, target);
      for (const f of start.fields) if (f.value) session.known.set(f.label, f.value);

      await page.exposeFunction('__sudarshanLearn', (e: LearnEvent) => {
        if (session.done || session.paused || !e.snap) return;
        session.lastActivity = Date.now();
        this.learnStep(target, session, e.snap);
        this.learnAnswers(e.snap, session, new Set(e.touched ?? []));
        if (e.type === 'click') this.onClick(page, target, session, e.text, e.snap);
      });
      // The extractor and recorder are re-added on every navigation, for multi-page forms.
      const setup = `window.__sudarshanExtract = ${extractFormInPage.toString()};
        window.__sudarshanScope = ${JSON.stringify(target.scopeSelector)};
        (${learnRecorderInPage.toString()})();`;
      await page.evaluateOnNewDocument(setup);
      await page.evaluate(setup);
      // A new page in this tab may be the confirmation, with nothing left to click.
      const onNavigated = (frame: Frame) => {
        if (frame === page.mainFrame()) this.lookForConfirmation(page, target, session);
      };
      page.on('framenavigated', onNavigated);
      page.once('close', () => {
        page.off('framenavigated', onNavigated);
        this.stop(target, session);
      });
    } catch (err) {
      this.logger.debug(`Could not watch ${target.domain}: ${(err as Error).message}`);
    }
  }

  /** While Sudarshan continues in the tab itself, what happens there is not learned as yours. */
  pause(page: Page, paused: boolean): void {
    const s = this.sessions.get(page);
    if (s) s.paused = paused;
  }

  /** When you last typed or clicked in this tab (0 if never); undefined when it is not watched. */
  lastActivity(page: Page): number | undefined {
    const s = this.sessions.get(page);
    return s ? (s.lastActivity ?? 0) : undefined;
  }

  /** The application in this tab was confirmed (by you or by Sudarshan). */
  finished(page: Page): boolean {
    return this.sessions.get(page)?.done === true;
  }

  private async snapshot(page: Page, target: WatchTarget): Promise<FormSnapshot> {
    const inScope = target.scopeSelector ? await this.runner.snapshot(page, target.scopeSelector) : null;
    // A multi-page form may leave the dialog for a plain page.
    return inScope?.scopeFound ? inScope : this.runner.snapshot(page, null);
  }

  private learnAnswers(snap: FormSnapshot, session: LearningSession, touched: Set<string>): void {
    for (const f of snap.fields) {
      const value = f.value.trim();
      if (!value || f.kind === FieldKind.FILE || !f.label || f.label.length < 3) continue;
      // Only what you typed or picked - not what the site filled in by itself.
      if (!touched.has(f.id) && !(f.name && touched.has(`name:${f.name}`))) continue;
      if (SECRET_QUESTION.test(`${f.label} ${f.name}`)) continue;
      if (session.known.get(f.label) === value) continue;
      session.known.set(f.label, value);
      if (this.answers.remember(f.label, value, AnswerSource.USER, f.kind)) session.answers++;
    }
  }

  private onClick(page: Page, target: WatchTarget, session: LearningSession, text: string, before: FormSnapshot): void {
    const action = before.actions.find((a) => a.text.trim().toLowerCase() === text.trim().toLowerCase());
    if (action && action.kind !== 'dismiss') {
      session.pending = {
        kind: action.kind === 'apply' ? 'apply' : 'advance',
        text: action.text,
        fingerprint: formFingerprint(before),
        signature: stepSignature(before),
      };
    }
    // A final submit shows a confirmation instead of new questions.
    this.lookForConfirmation(page, target, session);
  }

  /**
   * Checks the page for the site's confirmation a few times over the next seconds. Sites take a
   * moment to send an application, and often show the confirmation on a new page (Indeed) - a single
   * check straight after the click saw the old page, and missed it.
   */
  private lookForConfirmation(page: Page, target: WatchTarget, session: LearningSession): void {
    for (const ms of CONFIRM_CHECKS_MS) {
      setTimeout(() => {
        if (session.done || page.isClosed()) return;
        void page
          .evaluate(documentTextInPage)
          .then((doc) => {
            if (!session.done && (target.successUrl?.test(page.url()) || target.successPattern.test(doc) || CONFIRMED_WORLDWIDE.test(doc)))
              this.complete(target, session);
          })
          // Mid-navigation: a later check, or the new page's own check, will see it.
          .catch(() => undefined);
      }, ms);
    }
  }

  private learnStep(target: WatchTarget, session: LearningSession, now: FormSnapshot | null): void {
    const p = session.pending;
    if (!p || (now && formFingerprint(now) === p.fingerprint)) return;
    // Your click moved the form on - kept only if the application is then confirmed, so a button that
    // merely left the form (Save and close, a notifications link) is never learned.
    session.moves.push({ domain: target.domain, kind: p.kind, signature: p.signature, text: p.text, by: 'you' });
    session.pending = null;
  }

  private complete(target: WatchTarget, session: LearningSession): void {
    this.learnStep(target, session, null);
    session.done = true;
    // Confirmed: your steps, and Sudarshan's before it handed over, are good moves on this site.
    const moves = [...(target.agentMoves ?? []), ...session.moves];
    this.playbook.confirm(moves);
    this.recipes.confirm(moves);
    session.steps = session.moves.length;
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
    // Closed without a confirmation: your answers are kept, the buttons you pressed are not.
    if (session.answers) {
      this.events.emit({
        type: AgentEventType.LOG,
        level: 'info',
        jobId: target.jobId,
        message: `${target.jobLabel}: learned ${session.answers} answer(s) from you on ${target.domain} - steps are learned only from a confirmed application`,
      });
    }
  }
}
