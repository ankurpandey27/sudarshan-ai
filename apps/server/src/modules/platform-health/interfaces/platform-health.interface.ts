// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobPlatform } from '../../jobs/enums/job-platform.enum';

export interface PlatformHealth {
  platform: JobPlatform;
  /**
   * ok: working. broken: the last attempts all got stuck - paused until you finish one by hand or
   * choose "Try again". careful: resumed after a break - stops before Submit until one succeeds.
   */
  status: 'ok' | 'broken' | 'careful';
  /** Why it looks broken: the latest attempts' details, newest first. */
  recent: string[];
}
