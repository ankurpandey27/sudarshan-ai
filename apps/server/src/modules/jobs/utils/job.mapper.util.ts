import { JobSource } from '../enums/job-source.enum';
import { JobStatus } from '../enums/job-status.enum';
import { Job, JobRow, ScoreDetail } from '../interfaces/job.interface';

export function toJob(row: JobRow): Job {
  return {
    id: row.id,
    source: row.source as JobSource,
    externalId: row.external_id,
    url: row.url,
    applyUrl: row.apply_url,
    title: row.title,
    company: row.company,
    location: row.location,
    isRemote: row.is_remote === 1,
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
    attempts: row.attempts,
    origin: row.origin,
    discoveredAt: row.discovered_at,
    updatedAt: row.updated_at,
    appliedAt: row.applied_at,
  };
}
