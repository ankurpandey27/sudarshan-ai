import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'puppeteer-core';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { PendingQuestionsService } from '../answers/pending-questions.service';
import { BrowserService } from '../browser/browser.service';
import { AnswerEngineService } from '../form-engine/answer-engine.service';
import { FormRunnerService } from '../form-engine/form-runner.service';
import { RecipesService } from '../form-engine/recipes.service';
import { AnswerContext } from '../form-engine/interfaces/answer-context.interface';
import { FormRunOutcome } from '../form-engine/interfaces/form-run.interface';
import { JobsService } from '../jobs/jobs.service';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { JobSource } from '../jobs/enums/job-source.enum';
import { Job } from '../jobs/interfaces/job.interface';
import { ProfileService } from '../profile/profile.service';
import { SettingsService } from '../settings/settings.service';
import { LinkedInApplyAdapter } from './adapters/linkedin.adapter';
import { NaukriApplyAdapter } from './adapters/naukri.adapter';
import { WebApplyAdapter } from './adapters/web.adapter';
import { PrepareStatus } from './enums/prepare-status.enum';
import { ApplyAdapter, ApplyResult, PrepareResult } from './interfaces/apply-adapter.interface';

@Injectable()
export class ApplyService {
  private readonly logger = new Logger(ApplyService.name);
  private readonly adapters: ApplyAdapter[];

  constructor(
    linkedin: LinkedInApplyAdapter,
    naukri: NaukriApplyAdapter,
    private readonly web: WebApplyAdapter,
    private readonly browser: BrowserService,
    private readonly runner: FormRunnerService,
    private readonly recipes: RecipesService,
    private readonly jobs: JobsService,
    private readonly pending: PendingQuestionsService,
    private readonly profile: ProfileService,
    private readonly settings: SettingsService,
    private readonly events: EventsService,
  ) {
    this.adapters = [linkedin, naukri, web];
  }

  async apply(job: Job): Promise<ApplyResult> {
    const s = this.settings.get();
    const trace: string[] = [];
    const step = (m: string) => {
      trace.push(`${new Date().toISOString().slice(11, 19)} ${m}`);
      this.events.emit({ type: AgentEventType.APPLY_STEP, jobId: job.id, source: job.source, message: m });
    };
    const attemptId = this.jobs.startAttempt(job.id);
    this.jobs.setStatus(job.id, JobStatus.APPLYING, null);
    this.pending.clearForJob(job.id);
    step(`Applying: ${job.title} @ ${job.company}`);

    let page: Page | null = null;
    let keepOpen = false;
    let outcome: FormRunOutcome | null = null;
    let final: { status: JobStatus; detail: string };
    try {
      page = await this.browser.newPage();
      const adapter = this.adapters.find((a) => a.matches(job)) ?? this.web;
      let prep = await adapter.prepare(page, job);
      let active: ApplyAdapter = adapter;
      if (prep.page) page = prep.page;

      if (prep.status === PrepareStatus.EXTERNAL) {
        if (!s.sources.externalSites.enabled || !prep.externalUrl) {
          final = { status: JobStatus.MANUAL, detail: `Applies on the company site: ${prep.externalUrl ?? job.url}` };
          return this.finish(job, attemptId, final, outcome, trace, page, keepOpen);
        }
        step(`Company site: ${new URL(prep.externalUrl).hostname}`);
        prep = await this.web.prepareUrl(page, prep.externalUrl);
        if (prep.page) page = prep.page;
        active = this.web;
      }

      final = this.mapPrepare(prep, job);
      if (prep.status === PrepareStatus.READY) {
        const ctx = this.context(job);
        const opts = {
          scopeSelector: prep.scopeSelector,
          successPattern: prep.successPattern,
          ctx,
          domain: new URL(page.url()).hostname.replace(/^www\./, ''),
          allowLlm: true,
          pauseBeforeSubmit: s.agent.pauseBeforeSubmit,
          onStep: step,
        };
        const run: FormRunOutcome = active.runForm ? await active.runForm(page, prep, opts) : await this.runner.run(page, opts);
        outcome = run;
        final = this.mapOutcome(job, run);
        this.recipes.outcome(opts.domain, run.status === 'applied');
        if (run.status === 'applied') await active.afterSuccess?.(page);
        keepOpen = run.status === 'ready_to_submit' || run.status === 'captcha';
      } else if (prep.status === PrepareStatus.LOGIN_REQUIRED || prep.status === PrepareStatus.CAPTCHA) {
        keepOpen = true;
      }
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(`Apply failed for job ${job.id}: ${msg}`);
      final = { status: job.attempts + 1 >= 2 ? JobStatus.FAILED : JobStatus.APPROVED, detail: `Error: ${msg.slice(0, 200)}` };
    }
    return this.finish(job, attemptId, final, outcome, trace, page, keepOpen);
  }

  private async finish(
    job: Job,
    attemptId: number,
    final: { status: JobStatus; detail: string },
    outcome: FormRunOutcome | null,
    trace: string[],
    page: Page | null,
    keepOpen: boolean,
  ): Promise<ApplyResult> {
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
    );
    this.jobs.setStatus(job.id, final.status, final.detail);
    const level = final.status === JobStatus.APPLIED ? 'success' : final.status === JobStatus.FAILED ? 'error' : 'warn';
    this.events.emit({ type: AgentEventType.LOG, level, jobId: job.id, source: job.source, message: `${job.title} @ ${job.company}: ${final.detail}` });
    if (page && !keepOpen) await page.close().catch(() => undefined);
    return { status: final.status, detail: final.detail };
  }

  private mapPrepare(prep: PrepareResult, job: Job): { status: JobStatus; detail: string } {
    switch (prep.status) {
      case PrepareStatus.ALREADY_APPLIED:
        return { status: JobStatus.APPLIED, detail: 'You had already applied' };
      case PrepareStatus.CLOSED:
        return { status: JobStatus.SKIPPED, detail: prep.detail ?? 'No longer accepting applications' };
      case PrepareStatus.LOGIN_REQUIRED:
        // Job boards stay queued (the board is paused until login); other sites need a manual re-approve.
        return job.source === JobSource.WEB
          ? { status: JobStatus.MANUAL, detail: prep.detail ?? 'Log in to this site in the agent browser, then approve again' }
          : { status: JobStatus.APPROVED, detail: prep.detail ?? 'Waiting for you to log in' };
      case PrepareStatus.CAPTCHA:
        return { status: JobStatus.MANUAL, detail: 'Captcha - finish it in the agent browser window' };
      case PrepareStatus.NO_APPLY_BUTTON:
        return { status: JobStatus.MANUAL, detail: prep.detail ?? 'No apply button found - apply by hand' };
      default:
        return { status: JobStatus.APPLYING, detail: '' };
    }
  }

  private mapOutcome(job: Job, o: FormRunOutcome): { status: JobStatus; detail: string } {
    switch (o.status) {
      case 'applied':
        return { status: JobStatus.APPLIED, detail: `Applied in ${o.steps} step(s), ${o.llmCalls} AI call(s)` };
      case 'needs_input':
        for (const u of AnswerEngineService.toPending(o.unresolved)) this.pending.add({ jobId: job.id, ...u });
        return { status: JobStatus.NEEDS_INPUT, detail: o.detail };
      case 'ready_to_submit':
        return { status: JobStatus.MANUAL, detail: 'Filled in - review and press Submit in the agent browser' };
      case 'blocked':
      case 'captcha':
        return { status: JobStatus.MANUAL, detail: o.detail };
      default:
        return { status: job.attempts + 1 >= 2 ? JobStatus.FAILED : JobStatus.APPROVED, detail: o.detail };
    }
  }

  private context(job: Job): AnswerContext {
    return {
      profile: this.profile.get(),
      job: { id: job.id, title: job.title, company: job.company, location: job.location, description: job.description },
      resumePath: this.profile.resumePath(),
      skillYears: (skill) => this.profile.skillYears(skill),
    };
  }
}
