// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobPlatform } from '../../jobs/enums/job-platform.enum';

export interface PlatformHealth {
  platform: JobPlatform;
  /**
   * ok: working. broken: the last attempts all got stuck - paused until you finish one by hand or
   * choose "Try again". careful: resumed after a break - stops before Submit until one succeeds.
   * cooling: the site refused applications for now (too many too fast) - paused for a few hours.
   */
  status: 'ok' | 'broken' | 'careful' | 'cooling';
  /** Why it looks broken: the latest attempts' details, newest first. */
  recent: string[];
  /** When careful mode started, while careful. */
  since?: string;
  /** cooling: the site is refusing applications for now; tried again after this time. */
  until?: string;
}
