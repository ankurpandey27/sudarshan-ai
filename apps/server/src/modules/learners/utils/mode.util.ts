// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { DEMOTE_ACCURACY, PROMOTE_ACCURACY, PROMOTE_MIN_CHECKS } from '../constants/learners.constants';
import { LearnerMode } from '../enums/learner-mode.enum';
import { LearnerMetrics } from '../interfaces/learner-status.interface';

const proven = (m: LearnerMetrics | null) => !!m && m.checked >= PROMOTE_MIN_CHECKS && (m.accuracy ?? 0) >= PROMOTE_ACCURACY;

/**
 * When a learner may act: switched on, enough examples, and right often enough on cases it had not
 * seen - on held-out examples at training, or on live checks. Live checks falling off switch it back
 * to checking, so it cannot drift into making mistakes.
 */
export function decideMode(o: { enabled: boolean; examples: number; min: number; offline: LearnerMetrics | null; live: LearnerMetrics | null }): LearnerMode {
  if (!o.enabled) return LearnerMode.OFF;
  if (o.examples < o.min) return LearnerMode.LEARNING;
  const slipping = !!o.live && o.live.checked >= 10 && (o.live.accuracy ?? 1) < DEMOTE_ACCURACY;
  if (slipping) return LearnerMode.CHECKING;
  return proven(o.offline) || proven(o.live) ? LearnerMode.ON : LearnerMode.CHECKING;
}

/** Metrics from counts. */
export const metricsOf = (checked: number, right: number, how: string): LearnerMetrics => ({
  checked,
  right,
  accuracy: checked ? Math.round((right / checked) * 1000) / 1000 : null,
  how,
});
