// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobSource } from '../enums/job-source.enum';
import { JobPlatform } from '../enums/job-platform.enum';
import { JobStatus } from '../enums/job-status.enum';
import { JobRegion, WorkMode } from '../enums/job-place.enum';

export interface ScoreDetail {
  technical: number;
  salary: number;
  location: number;
  engine: number;
  llm: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  summary: string;
  /** SkipRule, when skipped. */
  skipRule?: string | null;
}

export interface Job {
  id: number;
  source: JobSource;
  /** Where it is applied to: LinkedIn, Naukri, Instahyre or another career site. */
  platform: JobPlatform;
  /** Host of the job page, e.g. "jobs.lever.co". */
  site: string;
  externalId: string;
  url: string;
  applyUrl: string | null;
  title: string;
  company: string;
  location: string;
  isRemote: boolean;
  /** Remote, hybrid or on-site; null until classified. */
  workMode: WorkMode | null;
  /** In your country, abroad, or unknown; null until classified. */
  region: JobRegion | null;
  easyApply: boolean;
  salaryRaw: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  skills: string[];
  postedAt: string | null;
  status: JobStatus;
  score: number | null;
  scoreDetail: ScoreDetail | null;
  reason: string | null;
  /** Chance you would approve it, from your own decisions (0-1); null while Sudarshan AI is still learning your taste. */
  taste: number | null;
  /** Why, strongest first, e.g. "+ title: backend". */
  tasteReasons: string[];
  attempts: number;
  origin: string;
  discoveredAt: string;
  updatedAt: string;
  appliedAt: string | null;
}

export interface JobRow {
  id: number;
  source: string;
  external_id: string;
  url: string;
  apply_url: string | null;
  title: string;
  company: string;
  location: string;
  is_remote: number;
  easy_apply: number;
  salary_raw: string | null;
  salary_min: number | null;
  salary_max: number | null;
  description: string;
  skills: string;
  posted_at: string | null;
  work_mode: string | null;
  region: string | null;
  status: string;
  score: number | null;
  score_detail: string | null;
  reason: string | null;
  taste: number | null;
  taste_reasons: string | null;
  attempts: number;
  origin: string;
  discovered_at: string;
  updated_at: string;
  applied_at: string | null;
}
