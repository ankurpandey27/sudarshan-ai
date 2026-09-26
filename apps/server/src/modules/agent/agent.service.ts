import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { PendingQuestionsService } from '../answers/pending-questions.service';
import { ApplyService } from '../apply/apply.service';
import { ApplyResult } from '../apply/interfaces/apply-adapter.interface';
import { BrowserService } from '../browser/browser.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { JobsService } from '../jobs/jobs.service';
import { JobSource } from '../jobs/enums/job-source.enum';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { LlmService } from '../llm/llm.service';
import { ScoringService } from '../scoring/scoring.service';
import { SettingsService } from '../settings/settings.service';
import { AgentPhase } from './enums/agent-phase.enum';
import { AgentStatus } from './interfaces/agent-status.interface';

const TICK_MS = 10_000;

@Injectable()
export class AgentService implements OnApplicationShutdown {
  private readonly logger = new Logger(AgentService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private ticking = false;
  private phase = AgentPhase.STOPPED;
  private currentJob: AgentStatus['currentJob'] = null;
  private nextDiscoveryAt = 0;
  private nextApplyAt = 0;
  private lastDiscoveryAt: number | null = null;
  private blocked: AgentStatus['blockedSources'] = [];
  private applying: Promise<ApplyResult> | null = null;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scoring: ScoringService,
    private readonly apply: ApplyService,
    private readonly jobs: JobsService,
    private readonly browser: BrowserService,
    private readonly settings: SettingsService,
    private readonly pending: PendingQuestionsService,
    private readonly llm: LlmService,
    private readonly events: EventsService,
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
      this.nextDiscoveryAt = Date.now();
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
    this.nextDiscoveryAt = Date.now() + this.settings.get().agent.intervalMinutes * 60_000;
    await this.runDiscovery();
  }

  async rescore(): Promise<number> {
    const n = this.jobs.resetForRescore();
    await this.scoring.scoreNew(1000);
    return n;
  }

  async applyNow(jobId: number): Promise<ApplyResult> {
    if (this.applying) return { status: 'busy', detail: 'Another application is in progress' };
    const job = this.jobs.get(jobId);
    await this.browser.ensure();
    return this.runApply(job);
  }

  status(): AgentStatus {
    return {
      running: this.running,
      phase: this.phase,
      currentJob: this.currentJob,
      nextDiscoveryAt: this.running && this.nextDiscoveryAt ? new Date(this.nextDiscoveryAt).toISOString() : null,
      nextApplyAt: this.running && this.nextApplyAt ? new Date(this.nextApplyAt).toISOString() : null,
      lastDiscoveryAt: this.lastDiscoveryAt ? new Date(this.lastDiscoveryAt).toISOString() : null,
      blockedSources: this.blocked,
      queue: this.jobs.queuedCount(),
      openQuestions: this.pending.openCount(),
      llm: this.llm.describe(),
      appliedToday: this.jobs.appliedToday(),
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
      if (this.applying || Date.now() < this.nextApplyAt) {
        if (!this.applying) this.setPhase(AgentPhase.WAITING);
        return;
      }
      const sources = await this.eligibleSources();
      const job = this.jobs.nextToApply(sources);
      if (!job) {
        if (this.discovery.isRunning()) {
          this.setPhase(AgentPhase.DISCOVERING);
        } else if (this.phase !== AgentPhase.IDLE) {
          this.setPhase(AgentPhase.IDLE);
          const review = this.jobs.countByStatus(JobStatus.REVIEW);
          this.log(
            'warn',
            review > 0
              ? `Nothing approved to apply to. ${review} job(s) are waiting for your approval in Review.`
              : 'Nothing to apply to right now. See "What needs attention" on Mission control for why.',
          );
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

  private async runApply(job: ReturnType<JobsService['get']>): Promise<ApplyResult> {
    this.currentJob = { id: job.id, title: job.title, company: job.company };
    this.setPhase(AgentPhase.APPLYING);
    this.applying = this.apply.apply(job);
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

  private async eligibleSources(): Promise<JobSource[]> {
    const s = this.settings.get().sources;
    const blocked: AgentStatus['blockedSources'] = [];
    const out: JobSource[] = [];
    const check = async (source: JobSource, enabled: boolean, limit: number, site?: 'linkedin' | 'naukri') => {
      if (!enabled) return;
      if (this.jobs.appliedToday(source) >= limit) {
        blocked.push({ source, reason: `Daily limit of ${limit} reached` });
        return;
      }
      if (site && this.jobs.list({ status: [JobStatus.APPROVED], source, limit: 1 }).total > 0 && !(await this.browser.isLoggedIn(site))) {
        blocked.push({ source, reason: `Log in to ${site === 'linkedin' ? 'LinkedIn' : 'Naukri'} to continue` });
        return;
      }
      out.push(source);
    };
    await check(JobSource.LINKEDIN, s.linkedin.enabled, s.linkedin.dailyLimit, 'linkedin');
    await check(JobSource.NAUKRI, s.naukri.enabled, s.naukri.dailyLimit, 'naukri');
    await check(JobSource.WEB, s.links.enabled, s.links.dailyLimit);
    const changed = JSON.stringify(blocked) !== JSON.stringify(this.blocked);
    this.blocked = blocked;
    if (changed) for (const b of blocked) this.log('warn', `${b.source}: ${b.reason}`);
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
