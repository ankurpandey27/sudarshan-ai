// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { PendingQuestionsService } from '../answers/pending-questions.service';
import { BrowserService } from '../browser/browser.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { JobsService } from '../jobs/jobs.service';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { LlmService } from '../llm/llm.service';
import { ProfileService } from '../profile/profile.service';
import { SKIP_RULE_FIX, SKIP_RULE_TEXT } from '../scoring/constants/skip-rule.constants';
import { SkipRule } from '../scoring/enums/skip-rule.enum';
import { SettingsService } from '../settings/settings.service';
import { AgentMode } from '../settings/enums/agent-mode.enum';
import { AgentService } from './agent.service';
import { Insight } from './interfaces/insight.interface';
import { sourceLabel } from '../jobs/utils/source-label.util';
import { PlatformHealthService } from '../platform-health/platform-health.service';
import { StorageService } from '../../common/storage/storage.service';
import { visibleInsights } from './utils/insight-dismissal.util';
import { clockTime } from '../../common/utils/date.util';
import { paceRisks } from '../settings/utils/pace-risks.util';

const FIELD_NAMES: Record<string, string> = {
  firstName: 'first name',
  lastName: 'last name',
  email: 'email',
  phone: 'phone',
  city: 'city',
  currentTitle: 'current title',
  totalYearsExperience: 'years of experience',
  noticePeriodDays: 'notice period',
  currentCtc: 'current CTC',
  expectedCtc: 'expected CTC',
};

@Injectable()
export class InsightsService {
  constructor(
    private readonly agent: AgentService,
    private readonly jobs: JobsService,
    private readonly profile: ProfileService,
    private readonly settings: SettingsService,
    private readonly llm: LlmService,
    private readonly browser: BrowserService,
    private readonly pending: PendingQuestionsService,
    private readonly discovery: DiscoveryService,
    private readonly health: PlatformHealthService,
    private readonly storage: StorageService,
  ) {}

  async list(): Promise<Insight[]> {
    // Each card's version is its title and detail unless it says otherwise (see Insight.version).
    const out: (Omit<Insight, 'version'> & { version?: string })[] = [];
    const settings = this.settings.get();
    const status = this.agent.status();
    const state = this.profile.state();
    const profile = state.profile;

    const failure = this.llm.failure();
    if (failure && failure.kind !== 'other') {
      out.push({
        id: 'llm-failure',
        severity: 'error',
        title: failure.kind === 'quota' ? `Your ${failure.provider} account has no credits` : `Your ${failure.provider} API key was rejected`,
        detail: `The AI model (${failure.model}) said: "${failure.message}". The agent keeps working without AI, but it reads resumes less accurately, scores jobs with simple rules only, and asks you more questions.`,
        fix:
          failure.kind === 'quota'
            ? 'Add credits at your provider, or switch to a free option: Google Gemini (free tier), Groq (free tier) or Ollama running on your PC.'
            : 'Paste a valid key in Settings and press "Test connection".',
        actions: [{ label: 'Open AI settings', to: '/settings' }],
      });
    } else if (!this.llm.isConfigured()) {
      out.push({
        id: 'llm-none',
        severity: 'info',
        title: 'No AI model connected',
        detail:
          'The agent is running on your profile and saved answers only. That works, but scoring is rule-based and new free-text questions come to you instead of being drafted.',
        fix: 'Add a model in Settings - Google Gemini and Groq have free tiers, Ollama is free on your PC.',
        actions: [{ label: 'Add a model', to: '/settings' }],
      });
    }

    if (!state.resume) {
      out.push({
        id: 'no-resume',
        severity: 'error',
        title: 'No resume uploaded',
        detail: 'Without a resume the agent does not know your skills and cannot attach a CV to applications.',
        fix: 'Upload your resume PDF on the Profile page.',
        actions: [{ label: 'Upload resume', to: '/profile' }],
      });
    } else if (profile.skills.length === 0) {
      out.push({
        id: 'no-skills',
        severity: 'error',
        title: 'Your profile has no skills',
        detail: 'Jobs are matched on skills. With none listed, matching is guesswork and the agent cannot answer "years of experience with X" questions.',
        fix: 'Upload your resume again on the Profile page, or add your skills there by hand.',
        actions: [{ label: 'Open profile', to: '/profile' }],
      });
    }
    const missing = state.missing.filter((f) => f !== 'firstName' || !!state.resume);
    if (state.resume && missing.length > 0) {
      out.push({
        id: 'profile-missing',
        severity: 'warn',
        title: `Profile is missing: ${missing.map((m) => FIELD_NAMES[m] ?? m).join(', ')}`,
        detail: 'Almost every application form asks for these. Without them the agent has to stop and ask you on each job.',
        fix: 'Fill them in once on the Profile page.',
        actions: [{ label: 'Complete profile', to: '/profile' }],
      });
    }
    if (this.discovery.keywords().length === 0) {
      out.push({
        id: 'no-keywords',
        severity: 'error',
        title: 'No job titles to search for',
        detail: 'The agent does not know what jobs to look for.',
        fix: 'Add job titles or keywords in Settings -> What to search.',
        actions: [{ label: 'Set keywords', to: '/settings' }],
      });
    }

    const risks = paceRisks(settings);
    if (risks.length) {
      out.push({
        id: 'pace-risk',
        severity: 'warn',
        title: 'Applying this fast can get your accounts restricted',
        detail: `Job sites watch for people who apply faster than a person could: ${risks.join('; ')}.`,
        fix: 'Open Settings -> Platforms & limits and press "Use safe pace" (then Save), or lower these yourself.',
        actions: [{ label: 'Open limits', to: '/settings?tab=platforms' }],
      });
    }

    const browser = await this.browser.status();
    if (!browser.executable) {
      out.push({
        id: 'no-browser',
        severity: 'error',
        title: 'No Chrome, Edge or Brave found',
        detail: 'The agent needs a Chromium browser to log in and apply.',
        fix: 'Install Google Chrome, or set the browser path in Settings.',
        actions: [{ label: 'Settings', to: '/settings' }],
      });
    }
    // A platform whose pages seem to have changed: paused, or resumed carefully.
    for (const health of this.health.all()) {
      const name = sourceLabel(health.platform);
      if (health.status === 'broken') {
        out.push({
          id: `changed-${health.platform}`,
          severity: 'error',
          title: `${name} may have changed its pages - paused`,
          detail: `The last few ${name} applications got stuck (latest: "${(health.recent[0] ?? '').slice(0, 140)}"). Rather than keep failing, Sudarshan stopped applying on ${name} - it tries one again by itself at ${clockTime(health.until)}.`,
          fix: this.settings.get().agent.carefulAfterPause
            ? `Finish one stuck application by hand in its open tab - Sudarshan learns the new steps from you - or press "Try again": it resumes and, as you set, stops before Submit on ${name}'s own forms until one works.`
            : `Finish one stuck application by hand in its open tab - Sudarshan learns the new steps from you - or press "Try again": it resumes normally. (To have it stop before Submit after a pause, turn on "Careful mode after a pause" in Settings.)`,
          actions: [
            { label: 'Try again', api: `/agent/platforms/${health.platform}/retry` },
            { label: 'See what happened', to: '/applications' },
          ],
        });
      } else if (health.status === 'cooling') {
        out.push({
          id: `cooling-${health.platform}`,
          version: `cooling until ${health.until ?? ''}`,
          severity: 'warn',
          title: `${name} is refusing applications for now - paused until ${clockTime(health.until)}`,
          detail: `${name} answered "please try again later" instead of taking the application - usually after many applications in a short time. Those jobs stay in the queue; Sudarshan tries ${name} again at ${clockTime(health.until)} and carries on with the other sites meanwhile.`,
          fix: `Nothing to do now. To make it less likely: a lower daily limit for ${name} (Settings, Platforms & limits) and a longer gap between applications (Settings, Agent).`,
          actions: [{ label: 'Limits', to: '/settings?tab=platforms' }],
        });
      } else if (health.status === 'careful' && this.settings.get().agent.carefulAfterPause) {
        out.push({
          id: `careful-${health.platform}`,
          // A new careful-mode episode is a new card, even though it reads the same.
          version: `careful since ${health.since ?? ''}`,
          severity: 'info',
          title: `${name}: careful mode`,
          detail: `After recent trouble, Sudarshan fills ${name}'s own application forms and stops before Submit, so you check each one. Company sites are not affected.`,
          fix: 'Press Submit in the open tab. After one application goes through, careful mode ends by itself - or turn it off in Settings (Careful mode after a pause).',
          actions: [
            { label: 'Applications', to: '/applications' },
            { label: 'Settings', to: '/settings?tab=agent' },
          ],
        });
      }
    }

    // The rescue agent kept failing with this AI model: it stepped aside, and says so.
    if (status.rescue.paused && this.settings.get().agent.rescue !== false) {
      out.push({
        id: 'rescue-paused',
        version: `rescue paused ${status.rescue.model} ${status.rescue.tries}`,
        severity: 'info',
        title: `Rescues keep failing with ${status.rescue.model}`,
        detail: `When the usual way gets stuck on a site, the AI takes over to move the application on. With this model it failed ${status.rescue.failedInARow} times in a row, so those jobs now come to you instead. Everything else works as usual.`,
        fix: 'A larger AI model (Settings, AI model) usually does better. Or try the rescues again with this one.',
        actions: [
          { label: 'Try rescues again', api: '/agent/rescue/retry' },
          { label: 'AI model', to: '/settings' },
        ],
      });
    }

    for (const block of status.blockedSources) {
      // Paused platforms have their own card above.
      if (/may have changed|refusing applications/i.test(block.reason)) continue;
      const login = /log in/i.test(block.reason);
      if (/switched off/i.test(block.reason)) {
        out.push({
          id: `off-${block.source}`,
          severity: 'info',
          title: `${sourceLabel(block.source)} is switched off`,
          detail: `You have approved ${sourceLabel(block.source)} jobs, but applying there is off, so they wait.`,
          fix: `Turn ${sourceLabel(block.source)} on under "Apply on" to apply to them, or leave it off.`,
          actions: [{ label: 'Apply on', to: '/#apply-on' }],
        });
        continue;
      }
      out.push({
        id: `blocked-${block.source}`,
        severity: login ? 'error' : 'info',
        title: login ? `Not logged in to ${sourceLabel(block.source)}` : `${sourceLabel(block.source)}: daily limit reached`,
        detail: login
          ? `There are ${sourceLabel(block.source)} jobs waiting in the queue, but the agent's browser is not logged in, so it cannot apply.`
          : `${block.reason}. This protects your account; the agent continues tomorrow.`,
        fix: login
          ? `Click "Log in", sign in to ${sourceLabel(block.source)} in the window that opens, then come back.`
          : 'Nothing to do, or raise the limit in Settings if you are sure.',
        actions: login ? [{ label: 'Log in', to: '/settings#sites' }] : [{ label: 'Limits', to: '/settings' }],
      });
    }

    const review = this.jobs.countByStatus(JobStatus.REVIEW);
    const queued = status.queue;
    const skipped = this.jobs.countByStatus(JobStatus.SKIPPED);
    const fresh = this.jobs.countByStatus(JobStatus.NEW);

    if (queued === 0 && review === 0 && skipped > 0 && fresh === 0) {
      const reasons = this.jobs.skippedBreakdown().slice(0, 3);
      const lines = reasons.map((r) => `${r.count} x ${SKIP_RULE_TEXT[r.rule as SkipRule] ?? 'filtered'}`).join('; ');
      const topFix = reasons[0] ? SKIP_RULE_FIX[reasons[0].rule as SkipRule] : undefined;
      out.push({
        id: 'all-skipped',
        severity: 'error',
        title: `All ${skipped} jobs found were skipped - nothing to apply to`,
        detail: `Why: ${lines || 'they did not match your profile'}.`,
        fix: topFix ?? 'Check your profile and search settings, then re-score.',
        actions: [
          { label: 'See skipped jobs', to: '/review?tab=skipped' },
          { label: 'Re-score jobs', api: '/agent/rescore' },
        ],
      });
    }
    if (review > 0 && queued === 0 && settings.agent.mode === AgentMode.REVIEW) {
      out.push({
        id: 'awaiting-approval',
        severity: 'warn',
        title: `${review} job${review === 1 ? '' : 's'} waiting for your approval`,
        detail: 'You are in Review mode: the agent only applies to jobs you approve.',
        fix: 'Open Review and approve the ones you want (or switch to Auto mode in Settings).',
        actions: [{ label: 'Review jobs', to: '/review' }],
      });
    }
    // Mid-search, new jobs are expected: they are scored when the search ends, so nothing to fix yet.
    if (fresh > 0 && !this.discovery.isRunning() && !this.agent.status().scoring) {
      out.push({
        id: 'unscored',
        severity: 'info',
        title: `${fresh} new job${fresh === 1 ? '' : 's'} not scored yet`,
        detail: 'They were found but have not been matched against your profile.',
        fix: 'Start the agent, or score them now.',
        actions: [{ label: 'Score now', api: '/agent/score-new' }],
      });
    }
    const questions = this.pending.openCount();
    if (questions > 0) {
      out.push({
        id: 'questions',
        severity: 'warn',
        title: `${questions} question${questions === 1 ? '' : 's'} only you can answer`,
        detail: 'Some applications are paused on questions your profile and saved answers do not cover.',
        fix: 'Answer them once - every job waiting on them continues automatically.',
        actions: [{ label: 'Answer questions', to: '/questions' }],
      });
    }
    const failed = this.jobs.countByStatus(JobStatus.FAILED);
    if (failed > 0) {
      out.push({
        id: 'failed',
        severity: 'warn',
        title: `${failed} application${failed === 1 ? '' : 's'} failed`,
        detail: 'The agent tried twice and could not finish. Each one shows the exact step that went wrong.',
        fix: 'Open Applications -> Needs attention, check the trace, and retry or apply by hand.',
        actions: [{ label: 'Open failed', to: '/applications?tab=attention' }],
      });
    }
    if (!status.running && queued > 0) {
      out.push({
        id: 'stopped',
        severity: 'info',
        title: `${queued} approved job${queued === 1 ? '' : 's'} ready - agent is stopped`,
        detail: 'Approved jobs are applied to only while the agent runs.',
        fix: 'Press "Start agent" (bottom left).',
        actions: [],
      });
    }
    const dismissed = new Map(this.storage.all<{ id: string; version: string }>('SELECT id, version FROM insight_dismissals').map((d) => [d.id, d.version]));
    return visibleInsights(out, dismissed);
  }

  /** Hides this card until it comes back with a different version (a new count, a new episode). */
  dismiss(id: string, version: string): void {
    this.storage.run(
      'INSERT INTO insight_dismissals (id, version, dismissed_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET version = excluded.version, dismissed_at = excluded.dismissed_at',
      [id, version, new Date().toISOString()],
    );
  }
}
