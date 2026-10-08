// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobStatus } from '../enums/job-status.enum';

/**
 * A job with the same company and title found within this many days is the same role listed again
 * (one listing per city on LinkedIn, or the same role on another site). Older ones may be a new opening.
 */
export const SAME_ROLE_WINDOW_DAYS = 30;

/** Which copy of a duplicated job is kept: the one furthest along. */
export const MERGE_KEEP_ORDER: JobStatus[] = [
  JobStatus.APPLIED,
  JobStatus.APPLYING,
  JobStatus.NEEDS_INPUT,
  JobStatus.MANUAL,
  JobStatus.APPROVED,
  JobStatus.REVIEW,
  JobStatus.NEW,
  JobStatus.SKIPPED,
  JobStatus.FAILED,
  JobStatus.DISMISSED,
];

/** Copies that may be dismissed as duplicates: only ones nothing has happened to yet. */
export const MERGEABLE: JobStatus[] = [JobStatus.NEW, JobStatus.REVIEW, JobStatus.APPROVED, JobStatus.SKIPPED];

/** Shown on a job whose application was stopped right after Submit was pressed: it may have gone through. */
export const INTERRUPTED_AFTER_SEND =
  'Sudarshan AI was stopped right after pressing Submit - check the site or your email to see whether it went through, then mark it Applied or queue it again';
