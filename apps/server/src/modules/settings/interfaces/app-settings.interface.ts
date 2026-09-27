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
