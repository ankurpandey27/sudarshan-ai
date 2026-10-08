// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Optional, Logger } from '@nestjs/common';
import { FOUND_ON } from './constants/apply.constants';
import { capAttempts } from './utils/attempt-cap.util';
import { experienceFrom } from './utils/experience.util';
import { AnswersService } from '../answers/answers.service';
import { Page } from 'puppeteer-core';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { PendingQuestionsService } from '../answers/pending-questions.service';
import { BrowserService } from '../browser/browser.service';
import { AnswerEngineService } from '../form-engine/answer-engine.service';
import { FormRunnerService } from '../form-engine/form-runner.service';
import { RecipesService } from '../form-engine/recipes.service';
import { PlaybookService } from '../form-engine/playbook.service';
import { LearnedMove } from '../form-engine/interfaces/learned-move.interface';
import { AnswerContext } from '../form-engine/interfaces/answer-context.interface';
import { FormRunOutcome } from '../form-engine/interfaces/form-run.interface';
import { JobsService } from '../jobs/jobs.service';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { Job } from '../jobs/interfaces/job.interface';
import { ProfileService } from '../profile/profile.service';
import { SettingsService } from '../settings/settings.service';
import { LinkedInApplyAdapter } from './adapters/linkedin.adapter';
import { NaukriApplyAdapter } from './adapters/naukri.adapter';
import { WebApplyAdapter } from './adapters/web.adapter';
import { SITE_OF_PLATFORM } from './constants/site-of-platform.constants';
import { IndeedApplyAdapter } from './adapters/indeed.adapter';
import { LearningService } from '../learning/learning.service';
import { WatchTarget } from '../learning/interfaces/watch-target.interface';
import { PrepareStatus } from './enums/prepare-status.enum';
import { ApplyAdapter, ApplyResult, PrepareResult } from './interfaces/apply-adapter.interface';
import { PlatformHealthService } from '../platform-health/platform-health.service';
import { REFUSED_COOLDOWN_MS } from '../platform-health/constants/platform-health.constants';
import { AttemptShot } from '../jobs/interfaces/attempt.interface';
import { LearnersTrainerService } from '../learners/learners-trainer.service';
import { CONTINUE_IDLE_MS, NEW_QUESTIONS, PAGE_SWAPPED_ERROR, TAB_CLOSED, TAB_CLOSED_ENDING, MAX_NETWORK_RETRIES, MAX_OPEN_TABS, MAX_SHOTS, NETWORK_ERROR } from './constants/apply.constants';
import { OpenTab } from './interfaces/open-tab.interface';
import { LiveApplication } from './interfaces/live-application.interface';
import { RunFormOptions } from '../form-engine/interfaces/form-run.interface';
import { AppSettings } from '../settings/interfaces/app-settings.interface';
import { onJobBoard } from './utils/offsite-url.util';
import { StoriesService } from '../stories/stories.service';
import { ResumesService } from '../resumes/resumes.service';

@Injectable()
export class ApplyService {
  private readonly logger = new Logger(ApplyService.name);
  private readonly adapters: ApplyAdapter[];

  // Step pictures of each running attempt, saved with it when it finishes.
  private readonly shots = new Map<number, AttemptShot[]>();
  /** Attempts in progress and their job, for the Live Eye. */
  private readonly liveJobs = new Map<number, number>();
  // Tabs handed over to you, by job: carried on from once you have unblocked them.
  private readonly tabs = new Map<number, OpenTab>();

  constructor(
    linkedin: LinkedInApplyAdapter,
    naukri: NaukriApplyAdapter,
    indeed: IndeedApplyAdapter,
    private readonly web: WebApplyAdapter,
    private readonly browser: BrowserService,
    private readonly runner: FormRunnerService,
    private readonly recipes: RecipesService,
    private readonly playbook: PlaybookService,
    private readonly jobs: JobsService,
    private readonly pending: PendingQuestionsService,
    private readonly answers: AnswersService,
    private readonly profile: ProfileService,
    private readonly settings: SettingsService,
    private readonly events: EventsService,
    private readonly learning: LearningService,
    private readonly health: PlatformHealthService,
    @Optional() private readonly stories?: StoriesService,
    @Optional() private readonly trainer?: LearnersTrainerService,
    @Optional() private readonly resumes?: ResumesService,
  ) {
    this.adapters = [linkedin, naukri, indeed, web];
  }

  apply(job: Job): Promise<ApplyResult> {
    // The browser must not be restarted (e.g. for a login window) while an application runs.
    return this.browser.busyWith(() => this.applyTo(job));
  }

  private async applyTo(job: Job): Promise<ApplyResult> {
    const settings = this.settings.get();
    const trace: string[] = [];
    const step = (m: string) => {
      trace.push(`${new Date().toISOString().slice(11, 19)} ${m}`);
      this.events.emit({ type: AgentEventType.APPLY_STEP, jobId: job.id, source: job.platform, message: m });
    };
    const attemptId = this.jobs.startAttempt(job.id);
    this.shots.set(attemptId, []);
    this.liveJobs.set(attemptId, job.id);
    this.jobs.setStatus(job.id, JobStatus.APPLYING, null);
    this.pending.clearForJob(job.id);
    step(`Applying: ${job.title} @ ${job.company}`);

    let page: Page | null = null;
    let keepOpen = false;
    let learnFrom: WatchTarget | null = null;
    let outcome: FormRunOutcome | null = null;
    // What was prepared, so Sudarshan AI can carry on in the tab after you unblock it.
    let preparedFor: { prep: PrepareResult; adapter: ApplyAdapter } | null = null;
    // `ended` says how the attempt ended (e.g. "run:stuck"); platform health reads it.
    let final: { status: JobStatus; detail: string; ended?: string };
    // Buttons pressed on the way; learned only once the site confirms the application.
    const moves: LearnedMove[] = [];
    try {
      page = await this.browser.newPage();
      const adapter = this.adapters.find((a) => a.matches(job)) ?? this.web;
      let prep = await adapter.prepare(page, job);
      moves.push(...(prep.moves ?? []));
      let active: ApplyAdapter = adapter;
      // Followed "Apply on company site": a login page from here on is the company's, not the job board's.
      let onCompanySite = false;
      if (prep.page) page = prep.page;

      if (prep.status === PrepareStatus.EXTERNAL) {
        if (!settings.sources.externalSites.enabled || !prep.externalUrl) {
          final = {
            status: JobStatus.MANUAL,
            detail: `Not applied - this job applies on the company's own site. Turn on "Company career sites" under Apply on, or apply by hand: ${prep.externalUrl ?? job.url}`,
            ended: 'prep:external_off',
          };
          return this.finish(job, attemptId, final, outcome, trace, page, keepOpen);
        }
        step(`Company site: ${new URL(prep.externalUrl).hostname}`);
        prep = await this.web.prepareUrl(page, prep.externalUrl, job);
        moves.push(...(prep.moves ?? []));
        if (prep.page) page = prep.page;
        active = this.web;
        onCompanySite = true;
      }

      final = { ...this.mapPrepare(prep, job, onCompanySite), ended: `prep:${prep.status}` };
      preparedFor = { prep, adapter: active };
      if (prep.status === PrepareStatus.READY) {
        const opts = this.formOptions(job, prep, page, attemptId, step, settings);
        const run: FormRunOutcome = active.runForm ? await active.runForm(page, prep, opts) : await this.runner.run(page, opts);
        outcome = run;
        moves.push(...(run.moves ?? []));
        final = { ended: `run:${run.status}`, ...this.mapOutcome(job, run) };
        this.recipes.outcome(opts.domain, run.status === 'applied');
        if (run.status === 'applied') await active.afterSuccess?.(page);
        // Left to the user: keep the tab and learn from how they finish it.
        keepOpen = ['ready_to_submit', 'captcha', 'stuck', 'blocked'].includes(run.status);
        if (keepOpen) {
          learnFrom = {
            jobId: job.id,
            jobLabel: `${job.title} @ ${job.company}`,
            domain: opts.domain,
            scopeSelector: prep.scopeSelector,
            successPattern: prep.successPattern,
            successUrl: prep.successUrl,
            // Sudarshan AI's own steps so far: learned too if you then finish the application.
            agentMoves: [...moves],
          };
        }
      } else if (prep.status === PrepareStatus.LOGIN_REQUIRED) {
        // Only a login page on the job board itself means its session ended (LinkedIn, 2026-09-28: a
        // LinkedIn job's Infosys careers login had marked LinkedIn logged out, again and again).
        const site = onCompanySite ? undefined : SITE_OF_PLATFORM[job.platform];
        // A job board's session ended: pause that board until you log in again, and close the tab.
        if (site) await this.browser.markLoggedOut(site);
        // A company site: the job waits in "Do by hand" with its login page open for you.
        else keepOpen = true;
      } else if (prep.status === PrepareStatus.CAPTCHA) {
        keepOpen = true;
      }
      // Handed over before the form (a captcha or a company login): still watched, so finishing it
      // yourself marks it applied.
      if (keepOpen && !learnFrom && page) {
        learnFrom = {
          jobId: job.id,
          jobLabel: `${job.title} @ ${job.company}`,
          domain: new URL(page.url()).hostname.replace(/^www\./, ''),
          scopeSelector: prep.scopeSelector,
          successPattern: prep.successPattern,
          successUrl: prep.successUrl,
          agentMoves: [...moves],
        };
      }
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(`Apply failed for job ${job.id}: ${msg}`);
      // A few network failures are the connection; more on the same job is the site (a dead domain).
      // Only a tab that is really gone was closed by you; a page replaced while it was read (Hirist's redirects,
      // "detached Frame", 2026-10-05) is a passing hitch - the job keeps its tries and goes round again.
      const tabGone = TAB_CLOSED.test(msg) && (!page || page.isClosed() || !this.browser.isRunning());
      final = tabGone
        ? // You closed its tab (or the browser) while it was applying: you stopped it - not a failed try.
          { status: JobStatus.MANUAL, detail: 'You closed its tab while Sudarshan AI was applying - approve it again to start over', ended: TAB_CLOSED_ENDING }
        : PAGE_SWAPPED_ERROR.test(msg) && this.jobs.countEndings(job.id, 'network') < MAX_NETWORK_RETRIES
          ? { status: JobStatus.APPROVED, detail: `The page changed while Sudarshan AI read it, will try again: ${msg.slice(0, 120)}`, ended: 'network' }
          : NETWORK_ERROR.test(msg) && this.jobs.countEndings(job.id, 'network') < MAX_NETWORK_RETRIES
          ? // The connection, not the job: it keeps its tries and its place in the queue.
            { status: JobStatus.APPROVED, detail: `Network problem, will try again: ${msg.slice(0, 160)}`, ended: 'network' }
          : { status: job.attempts + 1 >= 2 ? JobStatus.FAILED : JobStatus.APPROVED, detail: `Error: ${msg.slice(0, 200)}`, ended: 'error' };
    }
    this.learnFromEnding(final, moves, outcome);
    // The site refused it for now (too many too fast): nothing wrong with this job - it keeps its tries
    // and its place in the queue, and the site is left alone for a few hours.
    if (final.ended === 'network' || final.ended === NEW_QUESTIONS || final.ended === TAB_CLOSED_ENDING) this.jobs.forgetAttempt(job.id);
    if (final.ended === `prep:${PrepareStatus.REFUSED}` || final.ended === 'run:refused') {
      this.jobs.forgetAttempt(job.id);
      this.health.coolDown(job.platform, REFUSED_COOLDOWN_MS, final.detail);
    }
    // Never the same form again and again: after the last allowed try it goes to "Do by hand".
    final = capAttempts(final, job.attempts);
    const result = await this.finish(job, attemptId, final, outcome, trace, page, keepOpen);
    if (page && learnFrom) await this.learning.watch(page, learnFrom);
    if (page && keepOpen && preparedFor) this.remember(job.id, page, preparedFor.prep, preparedFor.adapter, moves, /captcha/i.test(final.detail));
    return result;
  }

  /** Jobs whose tab is still open for you - Sudarshan AI can carry on in them. */
  openTabs(): number[] {
    for (const [id, t] of this.tabs) if (t.page.isClosed()) this.tabs.delete(id);
    return [...this.tabs.keys()];
  }

  /**
   * Handed over for a captcha that you have since solved, and you have not touched the tab for a
   * moment (so it never races you pressing Submit yourself): Sudarshan AI can carry on.
   */
  async readyToContinue(): Promise<number[]> {
    if (this.settings.get().agent.pauseBeforeSubmit) return [];
    const ready: number[] = [];
    for (const [id, t] of this.tabs) {
      if (!t.captcha || t.page.isClosed() || this.learning.finished(t.page)) continue;
      // A captcha does not solve itself: only a tab you have worked in since it was handed over is carried on.
      // Lever's hCaptcha has no answer box to read, and its job went round every 3 minutes (HighLevel, 2026-10-05).
      const touched = this.learning.lastActivity(t.page) ?? 0;
      if (touched <= t.since) continue;
      const idle = Date.now() - Math.max(t.since, touched);
      if (idle < CONTINUE_IDLE_MS) continue;
      // Solved means the captcha's answer is filled in - not merely that no box shows: Lever's hCaptcha only appears
      // over Submit, so with it closed the job "looked solved" and was sent round again every 3 minutes (HighLevel, 2026-10-05).
      const token = await t.page
        .evaluate(() => {
          const boxes = Array.from(document.querySelectorAll('textarea[name="g-recaptcha-response"], textarea[name="h-captcha-response"], input[name="cf-turnstile-response"]'));
          return boxes.length === 0 ? null : boxes.some((b) => ((b as HTMLTextAreaElement).value ?? '').length > 10);
        })
        .catch(() => null);
      if (token === false) continue;
      const snap = await this.runner.snapshot(t.page, t.prep.scopeSelector).catch(() => null);
      if (snap && !snap.captcha) ready.push(id);
    }
    return ready;
  }

  /** Carries on in the tab you unblocked (a captcha solved, a login done), from where it is now. */
  continue(job: Job): Promise<ApplyResult> {
    return this.browser.busyWith(() => this.continueIn(job));
  }

  private async continueIn(job: Job): Promise<ApplyResult> {
    const tab = this.tabs.get(job.id);
    if (!tab || tab.page.isClosed()) {
      this.tabs.delete(job.id);
      return { status: job.status, detail: 'Its tab is closed - approve the job again to start over' };
    }
    if (job.status === JobStatus.APPLIED || this.learning.finished(tab.page)) {
      this.tabs.delete(job.id);
      return { status: JobStatus.APPLIED, detail: 'Already applied' };
    }
    const settings = this.settings.get();
    const trace: string[] = [];
    const step = (m: string) => {
      trace.push(`${new Date().toISOString().slice(11, 19)} ${m}`);
      this.events.emit({ type: AgentEventType.APPLY_STEP, jobId: job.id, source: job.platform, message: m });
    };
    const attemptId = this.jobs.startAttempt(job.id);
    this.shots.set(attemptId, []);
    this.liveJobs.set(attemptId, job.id);
    this.jobs.setStatus(job.id, JobStatus.APPLYING, null);
    step(`Continuing: ${job.title} @ ${job.company} - from where it was handed to you`);
    const page = tab.page;
    // Sudarshan AI's own clicks now are not yours to learn from.
    this.learning.pause(page, true);
    const moves = [...tab.moves];
    let run: FormRunOutcome | null = null;
    let final: { status: JobStatus; detail: string; ended?: string };
    try {
      const opts = this.formOptions(job, tab.prep, page, attemptId, step, settings);
      run = tab.adapter.runForm ? await tab.adapter.runForm(page, tab.prep, opts) : await this.runner.run(page, opts);
      moves.push(...(run.moves ?? []));
      final = { ended: `run:${run.status}`, ...this.mapOutcome(job, run) };
      if (run.status === 'applied') await tab.adapter.afterSuccess?.(page);
    } catch (err) {
      final = { status: JobStatus.MANUAL, detail: `Could not continue: ${(err as Error).message.slice(0, 160)} - finish it in the open tab`, ended: 'error' };
    }
    this.learnFromEnding(final, moves, run);
    const keepOpen = !!run && ['ready_to_submit', 'captcha', 'stuck', 'blocked'].includes(run.status);
    const result = await this.finish(job, attemptId, final, run, trace, page, keepOpen);
    if (keepOpen) {
      this.learning.pause(page, false);
      this.remember(job.id, page, tab.prep, tab.adapter, moves, run?.status === 'captcha');
    } else {
      this.tabs.delete(job.id);
    }
    return result;
  }

  private remember(jobId: number, page: Page, prep: PrepareResult, adapter: ApplyAdapter, moves: LearnedMove[], captcha: boolean): void {
    this.tabs.set(jobId, { page, prep, adapter, moves: [...moves], captcha, since: Date.now() });
    page.once('close', () => this.tabs.delete(jobId));
    // Every open tab costs memory (84 were left open on 2026-09-29): beyond a dozen, the oldest is closed. Its job stays
    // in "Do by hand" and opens again from Applications.
    const open = [...this.tabs.entries()].filter(([, t]) => !t.page.isClosed()).sort((a, b) => a[1].since - b[1].since);
    for (const [id, t] of open.slice(0, Math.max(0, open.length - MAX_OPEN_TABS))) {
      this.tabs.delete(id);
      void t.page.close().catch(() => undefined);
    }
  }

  /** How a form is filled for this job: the same rules whether it starts now or carries on after you. */
  private formOptions(job: Job, prep: PrepareResult, page: Page, attemptId: number, step: (m: string) => void, s: AppSettings): RunFormOptions {
    return {
      scopeSelector: prep.scopeSelector,
      successPattern: prep.successPattern,
      successUrl: prep.successUrl,
      ctx: this.context(job),
      domain: new URL(page.url()).hostname.replace(/^www\./, ''),
      allowLlm: true,
      // Careful mode (the platform was paused and tried again) - only if you turned it on, and only on the
      // job board's own forms, never a company site the job led to (Faye, 2026-09-30).
      pauseBeforeSubmit:
        s.agent.pauseBeforeSubmit || (s.agent.carefulAfterPause === true && this.health.state(job.platform).status === 'careful' && onJobBoard(page.url())),
      onStep: step,
      onShot: (p: Page, label: string) => this.shoot(attemptId, job.id, p, label),
      onSend: () => this.jobs.markSent(attemptId),
      rescue: s.agent.rescue !== false,
    };
  }

  /**
   * Learns from how the application ended, not from each click: a confirmed application keeps every
   * button that got it there; one that got stuck blames only the button that led into the dead end
   * (e.g. "Save and close", which leaves the form). Hand-overs (captcha, questions, login) teach nothing yet.
   */
  /** The newest application in progress and the step pictures taken so far - what Lakshya's Live Eye shows. */
  live(): LiveApplication | null {
    const newest = [...this.liveJobs.entries()].at(-1);
    if (!newest) return null;
    const [attemptId, jobId] = newest;
    const shots = (this.shots.get(attemptId) ?? []).map((shot, index) => ({ index, label: shot.label, at: shot.at }));
    return { jobId, attemptId, shots };
  }

  /** A step picture of an attempt still in progress - only those, nothing else on disk. */
  liveShotFile(attemptId: number, index: number): string | null {
    if (!this.liveJobs.has(attemptId)) return null;
    return this.shots.get(attemptId)?.[index]?.file ?? null;
  }

  /** A picture of the page for this attempt's replay (at most a couple of dozen per attempt). */
  private async shoot(attemptId: number, jobId: number, page: Page, label: string): Promise<void> {
    const list = this.shots.get(attemptId);
    if (!list || list.length >= MAX_SHOTS) return;
    const file = await this.browser.stepShot(page, `job-${jobId}-${attemptId}`);
    if (file) list.push({ label, file, at: new Date().toISOString() });
  }

  private learnFromEnding(final: { ended?: string }, moves: LearnedMove[], run: FormRunOutcome | null): void {
    if (final.ended === 'run:applied' || final.ended === `prep:${PrepareStatus.APPLIED}`) {
      this.playbook.confirm(moves);
      this.recipes.confirm(moves);
      // Steps the AI worked out (a rescue) just got an application through: the learners pick them up soon, not in hours.
      if (moves.some((m) => m.by === 'ai')) this.trainer?.trainSoon();
    } else if (final.ended === 'run:stuck') {
      this.playbook.blame(run?.stuckAt ?? run?.moves?.at(-1));
    }
  }

  private async finish(
    job: Job,
    attemptId: number,
    final: { status: JobStatus; detail: string; ended?: string },
    outcome: FormRunOutcome | null,
    trace: string[],
    page: Page | null,
    keepOpen: boolean,
  ): Promise<ApplyResult> {
    this.jobs.saveShots(attemptId, this.shots.get(attemptId) ?? []);
    this.shots.delete(attemptId);
    this.liveJobs.delete(attemptId);
    const screenshot = page && final.status !== JobStatus.APPLIED ? await this.browser.screenshot(page, `job-${job.id}`) : null;
    this.jobs.finishAttempt(
      attemptId,
      final.status,
      final.detail,
      {
        steps: outcome?.steps ?? 0,
        fields: outcome?.fields ?? 0,
        llmCalls: outcome?.llmCalls ?? 0,
        memoryHits: (outcome?.memoryHits ?? 0) + (outcome?.profileHits ?? 0),
      },
      trace,
      screenshot,
      final.ended ?? null,
    );
    this.jobs.setStatus(job.id, final.status, final.detail);
    const level = final.status === JobStatus.APPLIED ? 'success' : final.status === JobStatus.FAILED ? 'error' : 'warn';
    this.events.emit({ type: AgentEventType.LOG, level, jobId: job.id, source: job.platform, message: `${job.title} @ ${job.company}: ${final.detail}` });
    if (page && !keepOpen) await page.close().catch(() => undefined);
    return { status: final.status, detail: final.detail };
  }

  private mapPrepare(prep: PrepareResult, job: Job, onCompanySite = false): { status: JobStatus; detail: string } {
    switch (prep.status) {
      case PrepareStatus.ALREADY_APPLIED:
        return { status: JobStatus.APPLIED, detail: 'You had already applied' };
      case PrepareStatus.APPLIED:
        return { status: JobStatus.APPLIED, detail: prep.detail ?? 'Applied in one click' };
      case PrepareStatus.CLOSED:
        return { status: JobStatus.SKIPPED, detail: prep.detail ?? 'No longer accepting applications' };
      case PrepareStatus.LOGIN_REQUIRED:
        // Job boards stay queued (the board is paused until you log in again); other sites need you.
        return onCompanySite || !SITE_OF_PLATFORM[job.platform]
          ? { status: JobStatus.MANUAL, detail: prep.detail ?? 'Log in to this site in the agent browser, then approve again' }
          : { status: JobStatus.APPROVED, detail: prep.detail ?? 'Waiting for you to log in' };
      case PrepareStatus.CAPTCHA:
        return { status: JobStatus.MANUAL, detail: prep.detail ?? 'Captcha - finish it in the agent browser window' };
      case PrepareStatus.REFUSED:
        return { status: JobStatus.APPROVED, detail: prep.detail ?? 'The site is refusing applications for now - it stays in the queue' };
      case PrepareStatus.NO_APPLY_BUTTON:
        return { status: JobStatus.MANUAL, detail: prep.detail ?? 'No apply button found - apply by hand' };
      default:
        return { status: JobStatus.APPLYING, detail: '' };
    }
  }

  private mapOutcome(job: Job, o: FormRunOutcome): { status: JobStatus; detail: string; ended?: string } {
    switch (o.status) {
      case 'applied':
        return { status: JobStatus.APPLIED, detail: `Applied in ${o.steps} step(s), ${o.llmCalls} AI call(s)` };
      case 'needs_input': {
        const asked = AnswerEngineService.toPending(o.unresolved);
        // Questions never asked for this job before: progress, not a failed try (only the same ones coming back are).
        const fresh = !this.pending.askedBefore(job.id, asked.map((a) => a.question));
        for (const question of asked) this.pending.add({ jobId: job.id, ...question });
        return { status: JobStatus.NEEDS_INPUT, detail: o.detail, ...(fresh ? { ended: NEW_QUESTIONS } : {}) };
      }
      case 'ready_to_submit':
        return {
          status: JobStatus.MANUAL,
          detail: 'Filled in - Sudarshan AI stopped before Submit (you asked it to, in Settings) - review and press Submit in the agent browser',
        };
      case 'blocked':
      case 'captcha':
        return { status: JobStatus.MANUAL, detail: o.detail };
      case 'refused':
        return { status: JobStatus.APPROVED, detail: o.detail };
      case 'stuck':
        return { status: JobStatus.MANUAL, detail: `${o.detail} - finish it in the open tab; Sudarshan AI learns from what you do` };
      default:
        return { status: job.attempts + 1 >= 2 ? JobStatus.FAILED : JobStatus.APPROVED, detail: o.detail };
    }
  }

  private context(job: Job): AnswerContext {
    const profile = this.profile.get();
    const chosen = this.resumes?.forJob(job) ?? null;
    // Everything known about your years - profile and your own answers - the highest wins.
    const experience = experienceFrom({
      profileTotal: profile.totalYearsExperience,
      profileSkill: (skill) => this.profile.skillYears(skill),
      statedSkill: (skill) => this.profile.statedSkillYears(skill),
      yearsYouGave: (about) => this.answers.yearsYouGave(about),
    });
    return {
      profile: { ...profile, totalYearsExperience: experience.total },
      job: { id: job.id, title: job.title, company: job.company, location: job.location, description: job.description, foundOn: FOUND_ON[job.platform] },
      // The resume made for this kind of job, if you added one; your main resume otherwise.
      resumePath: chosen?.path ?? this.profile.resumePath(),
      resumeLabel: chosen?.label,
      skillYears: experience.skillYears,
      stories: this.stories?.forJob(`${job.title} ${job.description}`) ?? [],
      resumeText: this.profile.resumeText?.() ?? '',
    };
  }
}
