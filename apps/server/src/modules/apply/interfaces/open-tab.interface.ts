// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import type { Page } from 'puppeteer-core';
import { LearnedMove } from '../../form-engine/interfaces/learned-move.interface';
import { ApplyAdapter, PrepareResult } from './apply-adapter.interface';

/** A tab handed over to you, kept so Sudarshan can carry on from it once you have unblocked it. */
export interface OpenTab {
  page: Page;
  prep: PrepareResult;
  adapter: ApplyAdapter;
  /** What Sudarshan pressed before handing over; learned too if the application is then confirmed. */
  moves: LearnedMove[];
  /** It was handed over for a captcha: it can carry on by itself once you have solved it. */
  captcha: boolean;
  since: number;
}
