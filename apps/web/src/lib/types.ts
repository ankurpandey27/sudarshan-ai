// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Mirrors the server's response types.

export type JobStatus = 'new' | 'skipped' | 'review' | 'approved' | 'applying' | 'needs_input' | 'applied' | 'manual' | 'failed' | 'dismissed';

export type JobSource = 'linkedin' | 'naukri' | 'web';

export interface ScoreDetail {
  technical: number;
  salary: number;
  location: number;
  engine: number;
  llm: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  summary: string;
}

export type JobPlatform = 'linkedin' | 'naukri' | 'indeed' | 'instahyre' | 'other';

export interface Job {
  id: number;
  source: JobSource;
  platform: JobPlatform;
  /** Host of the job page, e.g. "jobs.lever.co". */
  site: string;
  url: string;
  applyUrl: string | null;
  title: string;
  company: string;
  location: string;
  isRemote: boolean;
  easyApply: boolean;
  salaryRaw: string | null;
  description: string;
  skills: string[];
  postedAt: string | null;
  status: JobStatus;
  score: number | null;
  scoreDetail: ScoreDetail | null;
  reason: string | null;
  /** Chance you would approve it (0-1), learned from your decisions; null while still learning. */
  taste: number | null;
  tasteReasons: string[];
  attempts: number;
  origin: string;
  discoveredAt: string;
  updatedAt: string;
  appliedAt: string | null;
}

export interface Attempt {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  outcome: string | null;
  detail: string | null;
  steps: number;
  fields: number;
  llmCalls: number;
  memoryHits: number;
  durationMs: number | null;
  trace: string[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface JobList extends Paginated<Job> {
  /** Matching jobs per platform, ignoring the platform filter. */
  platforms: Partial<Record<JobPlatform, number>>;
}

export interface JobStats {
  byStatus: Record<string, number>;
  appliedToday: number;
  appliedTodayBySource: Record<string, number>;
  appliedTodayByPlatform: Partial<Record<JobPlatform, number>>;
  queuedByPlatform: Partial<Record<JobPlatform, number>>;
  appliedTotal: number;
  medianApplySeconds: number | null;
  memoryHitRate: number | null;
}

export type AgentPhase = 'stopped' | 'idle' | 'discovering' | 'applying' | 'waiting' | 'sleeping';

export interface AgentStatus {
  running: boolean;
  phase: AgentPhase;
  currentJob: { id: number; title: string; company: string } | null;
  nextDiscoveryAt: string | null;
  nextApplyAt: string | null;
  lastDiscoveryAt: string | null;
  blockedSources: { source: string; reason: string }[];
  queue: number;
  awaitingReview: number;
  openQuestions: number;
  llm: string | null;
  appliedToday: number;
  scoring: ScoringProgress | null;
  platformHealth: { platform: JobPlatform; status: 'ok' | 'broken' | 'careful'; recent: string[] }[];
}

export interface ScoringProgress {
  total: number;
  done: number;
  stage: 'rules' | 'ai' | 'saving';
  skipped: number;
  startedAt: string;
  etaSeconds: number | null;
}

export interface AgentEvent {
  id: number;
  at: string;
  type: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  jobId?: number;
  source?: string;
  data?: Record<string, unknown>;
}

export type LlmProviderKind = 'none' | 'anthropic' | 'openai' | 'gemini' | 'groq' | 'openrouter' | 'ollama' | 'lmstudio' | 'opencode' | 'custom';

export interface LlmPreset {
  kind: LlmProviderKind;
  label: string;
  baseUrl: string;
  needsKey: boolean;
  local: boolean;
  keyUrl?: string;
  suggestedModels: string[];
  note?: string;
}

export interface PublicLlm {
  provider: LlmProviderKind;
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyHint: string;
}

export interface Settings {
  onboarded: boolean;
  llm: PublicLlm;
  fallbackLlm: PublicLlm;
  search: {
    keywords: string[];
    locations: string[];
    remoteOnly: boolean;
    easyApplyOnly: boolean;
    postedWithinDays: number;
    maxPerSearch: number;
    excludeCompanies: string[];
    excludeTitleWords: string[];
  };
  sources: Record<'linkedin' | 'naukri' | 'indeed' | 'instahyre' | 'links' | 'externalSites', { enabled: boolean; dailyLimit: number }>;
  agent: {
    mode: 'review' | 'auto';
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
  };
}

export interface LlmUsagePeriod {
  calls: number;
  failedCalls: number;
  promptTokens: number;
  completionTokens: number;
  tokens: number;
}

export interface LlmUsage {
  day: string;
  budget: number;
  today: LlmUsagePeriod;
  month: LlmUsagePeriod;
  allTime: LlmUsagePeriod & { since: string | null };
  byPurpose: { purpose: string; calls: number; tokens: number }[];
  byPurposeAllTime: { purpose: string; calls: number; tokens: number }[];
  byModel: { model: string; calls: number; tokens: number }[];
}

export interface Profile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phoneCountryCode: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  headline: string;
  currentTitle: string;
  currentCompany: string;
  totalYearsExperience: number;
  noticePeriodDays: number | null;
  currentCtc: number | null;
  expectedCtc: number | null;
  currency: string;
  willingToRelocate: boolean;
  remotePreferred: boolean;
  workAuthorization: string;
  needsSponsorship: boolean;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  skills: { name: string; years: number | null }[];
  education: { degree: string; field: string; institution: string; startYear: number | null; endYear: number | null; grade: string }[];
  experience: { title: string; company: string; location: string; start: string; end: string; current: boolean; summary: string }[];
  languages: string[];
  summary: string;
  gender: string;
  dateOfBirth: string;
}

export interface ProfileState {
  profile: Profile;
  resume: { name: string; uploadedAt: string } | null;
  missing: (keyof Profile)[];
  parsedWith: 'ai' | 'basic' | null;
}

export interface Answer {
  id: number;
  question: string;
  answer: string;
  fieldType: string | null;
  source: 'user' | 'excel' | 'llm';
  uses: number;
  updatedAt: string;
}

export interface PendingQuestion {
  key: string;
  question: string;
  fieldType: string;
  options: string[];
  suggestion: string | null;
  jobIds: number[];
  jobs: { id: number; title: string; company: string }[];
}

export interface BrowserStatus {
  running: boolean;
  executable: string | null;
  headless: boolean;
  sessions: { id: 'linkedin' | 'naukri' | 'instahyre' | 'indeed'; label: string; loggedIn: boolean }[];
}

export interface WorkbookImportResult {
  answers: number;
  links: { added: number; duplicates: number; invalid: string[] };
  preferences: string[];
  warnings: string[];
}

export interface Insight {
  id: string;
  severity: 'error' | 'warn' | 'info';
  title: string;
  detail: string;
  fix: string;
  actions: { label: string; to?: string; api?: string }[];
}

export interface ActivityDay {
  day: string;
  lines: number;
  problems: number;
}

export interface ActivityPage {
  items: AgentEvent[];
  hasMore: boolean;
  days: ActivityDay[];
  keepDays: number;
}

export interface AnalyticsReport {
  days: number;
  platform: JobPlatform | null;
  daily: { day: string; found: number; applied: Partial<Record<JobPlatform, number>> }[];
  current: { found: number; applied: number };
  previous: { found: number; applied: number };
  pipeline: { found: number; scored: number; matched: number; approved: number; applied: number };
  byPlatform: { platform: JobPlatform; found: number; applied: number }[];
  scores: { bucket: number; jobs: number; applied: number }[];
  skipReasons: { rule: string; label: string; fix: string; jobs: number }[];
  missingSkills: { skill: string; jobs: number }[];
}

export interface TasteState {
  status: 'learning' | 'ready';
  decisions: number;
  wanted: number;
  unwanted: number;
  needed: number;
  accuracy: number | null;
  likes: string[];
  dislikes: string[];
  trainedAt: string | null;
}
