// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Page } from 'puppeteer-core';
import { FormRunOutcome, RunFormOptions } from '../../form-engine/interfaces/form-run.interface';
import { Job } from '../../jobs/interfaces/job.interface';
import { PrepareStatus } from '../enums/prepare-status.enum';
import { LearnedMove } from '../../form-engine/interfaces/learned-move.interface';

export interface PrepareResult {
  status: PrepareStatus;
  /** null when the form is the page itself. */
  scopeSelector: string | null;
  successPattern: RegExp;
  externalUrl?: string;
  /** Set when the form opened in a new tab. */
  page?: Page;
  detail?: string;
  /** Buttons pressed to reach the form; learned only if the application is then confirmed. */
  moves?: LearnedMove[];
}

export interface ApplyAdapter {
  matches(job: Job): boolean;
  prepare(page: Page, job: Job): Promise<PrepareResult>;
  /** Overrides the generic form runner (e.g. Naukri's chat questionnaire). */
  runForm?(page: Page, prep: PrepareResult, opts: RunFormOptions): Promise<FormRunOutcome>;
  afterSuccess?(page: Page): Promise<void>;
}

export interface ApplyResult {
  status: string;
  detail: string;
}
