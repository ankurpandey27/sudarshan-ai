// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { LearnedMove } from '../../form-engine/interfaces/learned-move.interface';

export interface WatchTarget {
  jobId: number;
  jobLabel: string;
  domain: string;
  /** The application dialog, or null for a whole-page form. */
  scopeSelector: string | null;
  successPattern: RegExp;
  /** The site's confirmation page address, when it has one - counts whatever the page says. */
  successUrl?: RegExp;
  /** Sudarshan AI's own steps before handing over; learned too if you finish the application. */
  agentMoves?: LearnedMove[];
}
