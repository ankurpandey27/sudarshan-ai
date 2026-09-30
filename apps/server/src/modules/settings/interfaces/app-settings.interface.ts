// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { LlmProviderKind } from '../../llm/enums/llm-provider-kind.enum';
import { AgentMode } from '../enums/agent-mode.enum';

export interface LlmSettings {
  provider: LlmProviderKind;
  model: string;
  /** Encrypted at rest, masked over the API. */
  apiKey: string;
  baseUrl: string;
}

export interface SearchSettings {
  keywords: string[];
  locations: string[];
  remoteOnly: boolean;
  easyApplyOnly: boolean;
  postedWithinDays: number;
  maxPerSearch: number;
  excludeCompanies: string[];
  excludeTitleWords: string[];
  /**
   * Skills you mainly work with. A job asking for one is never skipped for a low score - it waits in
   * Review instead. Empty: taken from your search keywords, title and headline.
   */
  coreSkills: string[];
  /**
   * Skip internships, trainee and fresher roles, and jobs asking for fewer years than this at most
   * ("0-2 years" when this is 3). null: automatic - your experience minus a year, at most 3. 0: off.
   */
  minExperience: number | null;
}

export interface SourceSettings {
  enabled: boolean;
  dailyLimit: number;
}

export interface SourcesSettings {
  linkedin: SourceSettings;
  naukri: SourceSettings;
  instahyre: SourceSettings;
  indeed: SourceSettings;
  /** Every other career site (links from Excel or pasted). */
  links: SourceSettings;
  externalSites: SourceSettings;
}

export interface AgentSettings {
  mode: AgentMode;
  minApplyScore: number;
  minReviewScore: number;
  intervalMinutes: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  activeHoursStart: number;
  activeHoursEnd: number;
  headless: boolean;
  browserPath: string;
  llmScoring: boolean;
  tokenBudgetPerDay: number;
  pauseBeforeSubmit: boolean;
  /** Show the AI your own answers to similar questions (found by a small model on this computer). */
  pastAnswers: boolean;
  /** When the usual way gets stuck on a site, let the AI take several steps to move the application on. */
  rescue: boolean;
}

export interface AppSettings {
  onboarded: boolean;
  llm: LlmSettings;
  fallbackLlm: LlmSettings;
  search: SearchSettings;
  sources: SourcesSettings;
  agent: AgentSettings;
}

export type PublicLlmSettings = Omit<LlmSettings, 'apiKey'> & { apiKeyHint: string; hasApiKey: boolean };

export type PublicAppSettings = Omit<AppSettings, 'llm' | 'fallbackLlm'> & {
  llm: PublicLlmSettings;
  fallbackLlm: PublicLlmSettings;
};
