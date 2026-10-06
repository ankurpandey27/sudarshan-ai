// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobSource } from '../enums/job-source.enum';
import { platformOf, siteOf } from './platform.util';
import { JobStatus } from '../enums/job-status.enum';
import { JobRegion, WorkMode } from '../enums/job-place.enum';
import { Job, JobRow, ScoreDetail } from '../interfaces/job.interface';

export function toJob(row: JobRow): Job {
  return {
    id: row.id,
    source: row.source as JobSource,
    platform: platformOf(row.source as JobSource, row.url, row.apply_url),
    site: siteOf(row.url),
    externalId: row.external_id,
    url: row.url,
    applyUrl: row.apply_url,
    title: row.title,
    company: row.company,
    location: row.location,
    isRemote: row.is_remote === 1,
    workMode: (row.work_mode as WorkMode | null) ?? null,
    region: (row.region as JobRegion | null) ?? null,
    easyApply: row.easy_apply === 1,
    salaryRaw: row.salary_raw,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    description: row.description,
    skills: JSON.parse(row.skills) as string[],
    postedAt: row.posted_at,
    status: row.status as JobStatus,
    score: row.score,
    scoreDetail: row.score_detail ? (JSON.parse(row.score_detail) as ScoreDetail) : null,
    reason: row.reason,
    taste: row.taste ?? null,
    tasteReasons: row.taste_reasons ? (JSON.parse(row.taste_reasons) as string[]) : [],
    attempts: row.attempts,
    origin: row.origin,
    discoveredAt: row.discovered_at,
    updatedAt: row.updated_at,
    appliedAt: row.applied_at,
  };
}
