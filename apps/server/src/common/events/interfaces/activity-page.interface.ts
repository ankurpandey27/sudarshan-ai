// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AgentEvent } from './agent-event.interface';

export interface ActivityDay {
  /** Local date, YYYY-MM-DD. */
  day: string;
  lines: number;
  problems: number;
}

export interface ActivityPage {
  /** Newest first. */
  items: AgentEvent[];
  /** Pass the last item's id as beforeId to load older lines. */
  hasMore: boolean;
  /** Every day still kept, newest first. */
  days: ActivityDay[];
  keepDays: number;
}
