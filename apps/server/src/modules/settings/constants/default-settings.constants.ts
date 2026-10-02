// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { LlmProviderKind } from '../../llm/enums/llm-provider-kind.enum';
import { AgentMode } from '../enums/agent-mode.enum';
import { AppSettings } from '../interfaces/app-settings.interface';

export const DEFAULT_SETTINGS: AppSettings = {
  onboarded: false,
  llm: { provider: LlmProviderKind.NONE, model: '', apiKey: '', baseUrl: '' },
  fallbackLlm: { provider: LlmProviderKind.NONE, model: '', apiKey: '', baseUrl: '' },
  search: {
    keywords: [],
    locations: ['India'],
    remoteOnly: false,
    easyApplyOnly: true,
    postedWithinDays: 7,
    maxPerSearch: 25,
    excludeCompanies: [],
    excludeTitleWords: [],
    coreSkills: [],
    minExperience: null,
  },
  sources: {
    // LinkedIn restricts accounts that apply too fast.
    linkedin: { enabled: true, dailyLimit: 25 },
    naukri: { enabled: true, dailyLimit: 40 },
    instahyre: { enabled: true, dailyLimit: 30 },
    // Indeed is the strictest about automation: keep it low.
    indeed: { enabled: false, dailyLimit: 15 },
    // Off until you log in to them (Settings -> Site logins).
    foundit: { enabled: false, dailyLimit: 20 },
    hirist: { enabled: false, dailyLimit: 20 },
    himalayas: { enabled: false, dailyLimit: 20 },
    links: { enabled: true, dailyLimit: 30 },
    externalSites: { enabled: false, dailyLimit: 15 },
  },
  agent: {
    mode: AgentMode.REVIEW,
    minApplyScore: 70,
    minReviewScore: 45,
    intervalMinutes: 60,
    minDelaySeconds: 40,
    maxDelaySeconds: 110,
    // Applying through the night looks like a robot.
    activeHoursStart: 8,
    activeHoursEnd: 23,
    headless: false,
    browserPath: '',
    llmScoring: true,
    tokenBudgetPerDay: 300_000,
    pauseBeforeSubmit: false,
    pastAnswers: true,
    rescue: true,
    carefulAfterPause: false,
    backupFolder: '',
    dailySummaryHour: 21,
    notifyNeedsYou: true,
  },
};

export const SETTINGS_SECTIONS = ['onboarded', 'llm', 'fallbackLlm', 'search', 'sources', 'agent'] as const;
