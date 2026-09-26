import { JobSource } from '../enums/job-source.enum';
import { JobStatus } from '../enums/job-status.enum';

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
  externalId: string;
  url: string;
  applyUrl: string | null;
  title: string;
  company: string;
  location: string;
  isRemote: boolean;
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
  status: string;
  score: number | null;
  score_detail: string | null;
  reason: string | null;
  attempts: number;
  origin: string;
  discovered_at: string;
  updated_at: string;
  applied_at: string | null;
}
