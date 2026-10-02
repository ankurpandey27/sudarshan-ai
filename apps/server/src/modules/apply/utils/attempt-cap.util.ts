// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobStatus } from '../../jobs/enums/job-status.enum';
import { MAX_APPLY_ATTEMPTS, NEW_QUESTIONS } from '../constants/apply.constants';
import { PrepareStatus } from '../enums/prepare-status.enum';

interface AttemptEnd {
  status: JobStatus;
  detail: string;
  ended?: string;
}

/**
 * After the last allowed try, a job that would go back to the queue (or wait for answers that
 * will lead to the same form again) goes to "Do by hand" instead, so the queue never loops on it.
 * A job board that logged out is not a failed try: its jobs wait for you to log in.
 */
export function capAttempts<T extends AttemptEnd>(end: T, previousAttempts: number): T {
  const retrying = end.status === JobStatus.APPROVED || end.status === JobStatus.NEEDS_INPUT;
  // Not a failed try: a job board that logged out, or a site refusing applications for now.
  const notTheJob = [`prep:${PrepareStatus.LOGIN_REQUIRED}`, `prep:${PrepareStatus.REFUSED}`, 'run:refused', NEW_QUESTIONS].includes(end.ended ?? '');
  if (!retrying || previousAttempts + 1 < MAX_APPLY_ATTEMPTS || notTheJob) return end;
  return { ...end, status: JobStatus.MANUAL, detail: `Tried ${MAX_APPLY_ATTEMPTS} times without finishing - ${end.detail || 'apply by hand'}` };
}
