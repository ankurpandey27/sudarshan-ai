// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { PendingQuestionsService } from '../answers/pending-questions.service';
import { ApplyService } from '../apply/apply.service';
import { ApplyResult } from '../apply/interfaces/apply-adapter.interface';
import { BrowserService } from '../browser/browser.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { sourceLabel } from '../jobs/utils/source-label.util';
import { JobPlatform } from '../jobs/enums/job-platform.enum';
import { SourceSettings } from '../settings/interfaces/app-settings.interface';
import { JobsService } from '../jobs/jobs.service';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { LlmService } from '../llm/llm.service';
import { ScoringService } from '../scoring/scoring.service';
import { SettingsService } from '../settings/settings.service';
import { AgentPhase } from './enums/agent-phase.enum';
import { AgentStatus } from './interfaces/agent-status.interface';
import { SiteId } from '../browser/interfaces/site-session.interface';
import { PlatformHealthService } from '../platform-health/platform-health.service';
import { clockTime } from '../../common/utils/date.util';
import { EmbeddingsService } from '../../common/embeddings/embeddings.service';
import { RescueService } from '../form-engine/rescue.service';

const TICK_MS = 10_000;

@Injectable()
export class AgentService implements OnApplicationShutdown {
  private readonly logger = new Logger(AgentService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private ticking = false;
  // Last "why nothing is being applied" message, so each reason is logged once.
  private idleNote: string | null = null;
  private phase = AgentPhase.STOPPED;
  private currentJob: AgentStatus['currentJob'] = null;
  private nextDiscoveryAt = 0;
  private nextApplyAt = 0;
  private lastDiscoveryAt: number | null = null;
  private blocked: AgentStatus['blockedSources'] = [];
  private applying: Promise<ApplyResult> | null = null;

  constructor(
    private readonly health: PlatformHealthService,
    private readonly discovery: DiscoveryService,
    private readonly scoring: ScoringService,
    private readonly apply: ApplyService,
    private readonly jobs: JobsService,
    private readonly browser: BrowserService,
    private readonly settings: SettingsService,
    private readonly pending: PendingQuestionsService,
    private readonly llm: LlmService,
    private readonly events: EventsService,
    private readonly embeddings: EmbeddingsService,
    private readonly rescue: RescueService,
  ) {
    // Subscribe here, before any bootstrap hook can emit.
    this.events.stream().subscribe((e) => {
      if (e.type === AgentEventType.PROFILE_UPDATED && !this.discovery.isRunning()) {
        void this.scoring.scoreNew(1000).catch((err: Error) => this.log('error', `Re-scoring failed: ${err.message}`));
      }
    });
  }

  async start(): Promise<AgentStatus> {
    if (!this.running) {
      await this.browser.ensure();
      this.running = true;
      // A search that just ran (e.g. Search now) counts; don't repeat it on start.
      const interval = this.settings.get().agent.intervalMinutes * 60_000;
      this.nextDiscoveryAt = this.lastDiscoveryAt ? Math.max(Date.now(), this.lastDiscoveryAt + interval) : Date.now();
      this.nextApplyAt = Date.now();
      this.timer = setInterval(() => void this.tick(), TICK_MS);
      this.log('success', 'Agent started');
      void this.tick();
    }
    return this.status();
  }

  stop(): AgentStatus {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    this.setPhase(AgentPhase.STOPPED);
    this.log('info', this.applying ? 'Agent stopping after the current application' : 'Agent stopped');
    return this.status();
  }

  async discoverNow(): Promise<void> {
    if (this.discovery.isRunning()) {
      this.log('info', 'A search is already running');
      return;
    }
    this.log('info', 'Searching now (Search now was pressed)');
    this.nextDiscoveryAt = Date.now() + this.settings.get().agent.intervalMinutes * 60_000;
    await this.runDiscovery();
  }

  /** Scores every job in Review and Skipped again, in the background (progress is in the status). */
  rescore(): number {
    const n = this.jobs.resetForRescore();
    this.scoreInBackground();
    return n;
  }

  /** Scores only jobs not scored yet, in the background. */
  scoreUnscored(): number {
    const n = this.jobs.unscored(1000).length;
    this.scoreInBackground();
    return n;
  }

  private scoreInBackground(): void {
    void this.scoring.scoreNew(1000).catch((err: Error) => this.log('error', `Scoring failed: ${err.message}`));
  }

  async applyNow(jobId: number): Promise<ApplyResult> {
    if (this.applying) return { status: 'busy', detail: 'Another application is in progress' };
    const job = this.jobs.get(jobId);
    // The slot is taken before waiting for the browser, so a second click or the agent loop cannot start another.
    return this.runApply(job, () => this.browser.ensure());
  }

  /** Carry on in a tab handed over to you, now that you have unblocked it (the Continue button). */
  async continueNow(jobId: number): Promise<ApplyResult> {
    if (this.applying) return { status: 'busy', detail: 'Another application is in progress - try again in a moment' };
    const job = this.jobs.get(jobId);
    return this.runApply(job, undefined, () => this.apply.continue(job));
  }

  status(): AgentStatus {
    return {
      running: this.running,
      phase: this.phase,
      currentJob: this.currentJob,
      nextDiscoveryAt: this.running && this.nextDiscoveryAt ? new Date(this.nextDiscoveryAt).toISOString() : null,
      // Only meaningful when something is queued.
      nextApplyAt: this.running && this.nextApplyAt && this.jobs.queuedCount() > 0 ? new Date(Math.max(this.nextApplyAt, Date.now())).toISOString() : null,
      lastDiscoveryAt: this.lastDiscoveryAt ? new Date(this.lastDiscoveryAt).toISOString() : null,
      blockedSources: this.blocked,
      queue: this.jobs.queuedCount(),
      awaitingReview: this.jobs.countByStatus(JobStatus.REVIEW),
      openQuestions: this.pending.openCount(),
      llm: this.llm.describe(),
      appliedToday: this.jobs.appliedToday(),
      scoring: this.scoring.progress(),
      lastScoring: this.scoring.justFinished(),
      platformHealth: this.health.all().filter((h) => h.status !== 'ok'),
      meaningModel: this.embeddings.status(),
      rescue: this.rescue.status(),
    };
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (!this.running || this.ticking) return;
    this.ticking = true;
    try {
      const s = this.settings.get();
      if (!this.inActiveHours(s.agent.activeHoursStart, s.agent.activeHoursEnd)) {
        this.setPhase(AgentPhase.SLEEPING);
        return;
      }
      if (Date.now() >= this.nextDiscoveryAt && !this.discovery.isRunning()) {
        this.nextDiscoveryAt = Date.now() + s.agent.intervalMinutes * 60_000;
        // Not awaited, so applying continues during discovery.
        void this.runDiscovery();
      }
      if (!this.discovery.isRunning() && this.jobs.unscored(1).length) await this.scoring.scoreNew();
      // You solved a captcha in a tab handed over to you and left it: carry on there first - it is nearly done.
      if (!this.applying) {
        const [ready] = await this.apply.readyToContinue().catch(() => []);
        if (ready !== undefined && !this.applying) {
          const job = this.jobs.get(ready);
          this.log('info', `${job.title} @ ${job.company}: captcha solved - carrying on where it stopped`);
          await this.runApply(job, undefined, () => this.apply.continue(job));
          return;
        }
      }
      if (this.applying || Date.now() < this.nextApplyAt) {
        if (!this.applying) this.setPhase(AgentPhase.WAITING);
        return;
      }
      const platforms = await this.eligiblePlatforms();
      // Something may have started while platforms were checked (Apply now).
      if (this.applying) return;
      const job = this.jobs.nextToApply(platforms);
      if (!job) {
        if (this.discovery.isRunning()) {
          this.setPhase(AgentPhase.DISCOVERING);
        } else {
          this.setPhase(AgentPhase.IDLE);
          const queued = this.jobs.queuedCount();
          const review = this.jobs.countByStatus(JobStatus.REVIEW);
          const note =
            queued > 0
              ? `${queued} approved job(s) are waiting: ${this.blocked.map((b) => `${sourceLabel(b.source)} - ${b.reason}`).join('; ') || 'their job sites are turned off in Settings'}.`
              : review > 0
                ? `Nothing approved to apply to yet - ${review} job(s) are waiting for your approval in Review.`
                : 'Nothing to apply to right now. See "What needs attention" on Lakshya for why.';
          if (note !== this.idleNote) {
            this.idleNote = note;
            this.log('warn', note);
          }
        }
        return;
      }
      await this.runApply(job);
      const gap = s.agent.minDelaySeconds + Math.random() * Math.max(0, s.agent.maxDelaySeconds - s.agent.minDelaySeconds);
      this.nextApplyAt = Date.now() + gap * 1000;
    } catch (err) {
      this.log('error', `Agent tick failed: ${(err as Error).message}`);
    } finally {
      this.ticking = false;
    }
  }

  /** Claims the single apply slot synchronously (no await before it is set), then applies. */
  private async runApply(job: ReturnType<JobsService['get']>, before?: () => Promise<unknown>, work?: () => Promise<ApplyResult>): Promise<ApplyResult> {
    this.currentJob = { id: job.id, title: job.title, company: job.company };
    this.idleNote = null;
    this.setPhase(AgentPhase.APPLYING);
    this.applying = (async () => {
      await before?.();
      return work ? work() : this.apply.apply(job);
    })();
    try {
      return await this.applying;
    } finally {
      this.applying = null;
      this.currentJob = null;
      this.setPhase(this.running ? AgentPhase.WAITING : AgentPhase.STOPPED);
    }
  }

  private async runDiscovery(): Promise<void> {
    this.setPhase(AgentPhase.DISCOVERING);
    try {
      await this.discovery.run();
      this.lastDiscoveryAt = Date.now();
      await this.scoring.scoreNew();
    } catch (err) {
      this.log('error', `Discovery failed: ${(err as Error).message}`);
    } finally {
      if (!this.applying) this.setPhase(this.running ? AgentPhase.IDLE : AgentPhase.STOPPED);
    }
  }

  /** Platforms switched on, under today's limit and logged in. */
  private async eligiblePlatforms(): Promise<JobPlatform[]> {
    const s = this.settings.get().sources;
    const blocked: AgentStatus['blockedSources'] = [];
    const out: JobPlatform[] = [];
    const check = async (platform: JobPlatform, cfg: SourceSettings | undefined, site?: SiteId) => {
      const queued = this.jobs.queuedOn(platform);
      if (!cfg?.enabled) {
        // Approved jobs on a switched-off platform wait; they are not lost.
        if (queued > 0) blocked.push({ source: platform, reason: `switched off - ${queued} approved job(s) wait until you turn it on` });
        return;
      }
      const health = this.health.state(platform);
      if (health.status === 'broken') {
        blocked.push({
          source: platform,
          reason: `paused - the last applications got stuck, the site may have changed its pages; tries one again at ${clockTime(health.until)}`,
        });
        return;
      }
      if (health.status === 'cooling') {
        blocked.push({ source: platform, reason: `refusing applications for now - tries again at ${clockTime(health.until)}` });
        return;
      }
      if (this.jobs.appliedToday(platform) >= cfg.dailyLimit) {
        blocked.push({ source: platform, reason: `Daily limit of ${cfg.dailyLimit} reached` });
        return;
      }
      if (site && queued > 0 && !(await this.browser.isLoggedIn(site))) {
        blocked.push({ source: platform, reason: 'not logged in - log in from Settings, Site logins' });
        return;
      }
      out.push(platform);
    };
    await check(JobPlatform.LINKEDIN, s.linkedin, 'linkedin');
    await check(JobPlatform.NAUKRI, s.naukri, 'naukri');
    await check(JobPlatform.INSTAHYRE, s.instahyre, 'instahyre');
    await check(JobPlatform.INDEED, s.indeed, 'indeed');
    // No login check before applying: their sign-in is checked at the form.
    await check(JobPlatform.FOUNDIT, s.foundit);
    await check(JobPlatform.HIRIST, s.hirist);
    await check(JobPlatform.OTHER, s.links);
    const changed = JSON.stringify(blocked) !== JSON.stringify(this.blocked);
    this.blocked = blocked;
    if (changed) for (const b of blocked) this.log('warn', `${sourceLabel(b.source)}: ${b.reason}`);
    return out;
  }

  private inActiveHours(start: number, end: number): boolean {
    const h = new Date().getHours();
    return start <= end ? h >= start && h < end : h >= start || h < end;
  }

  private setPhase(phase: AgentPhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.events.emit({ type: AgentEventType.AGENT_STATE, message: phase, data: { phase, running: this.running } });
  }

  private log(level: 'info' | 'success' | 'warn' | 'error', message: string): void {
    this.events.emit({ type: AgentEventType.LOG, level, message });
  }
}
