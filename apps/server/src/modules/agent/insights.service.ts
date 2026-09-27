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
  ) {}

  async list(): Promise<Insight[]> {
    const out: Insight[] = [];
    const s = this.settings.get();
    const status = this.agent.status();
    const state = this.profile.state();
    const p = state.profile;

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
    } else if (p.skills.length === 0) {
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
    for (const b of status.blockedSources) {
      const login = /log in/i.test(b.reason);
      if (/switched off/i.test(b.reason)) {
        out.push({
          id: `off-${b.source}`,
          severity: 'info',
          title: `${sourceLabel(b.source)} is switched off`,
          detail: `You have approved ${sourceLabel(b.source)} jobs, but applying there is off, so they wait.`,
          fix: `Turn ${sourceLabel(b.source)} on under "Apply on" to apply to them, or leave it off.`,
          actions: [{ label: 'Apply on', to: '/#apply-on' }],
        });
        continue;
      }
      out.push({
        id: `blocked-${b.source}`,
        severity: login ? 'error' : 'info',
        title: login ? `Not logged in to ${sourceLabel(b.source)}` : `${sourceLabel(b.source)}: daily limit reached`,
        detail: login
          ? `There are ${sourceLabel(b.source)} jobs waiting in the queue, but the agent's browser is not logged in, so it cannot apply.`
          : `${b.reason}. This protects your account; the agent continues tomorrow.`,
        fix: login
          ? `Click "Log in", sign in to ${sourceLabel(b.source)} in the window that opens, then come back.`
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
    if (review > 0 && queued === 0 && s.agent.mode === AgentMode.REVIEW) {
      out.push({
        id: 'awaiting-approval',
        severity: 'warn',
        title: `${review} job${review === 1 ? '' : 's'} waiting for your approval`,
        detail: 'You are in Review mode: the agent only applies to jobs you approve.',
        fix: 'Open Review and approve the ones you want (or switch to Auto mode in Settings).',
        actions: [{ label: 'Review jobs', to: '/review' }],
      });
    }
    if (fresh > 0) {
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
    const rank = { error: 0, warn: 1, info: 2 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }
}
