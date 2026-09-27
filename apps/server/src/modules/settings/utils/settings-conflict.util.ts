// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AppSettings } from '../interfaces/app-settings.interface';

/** Settings that are each valid but contradict each other, explained; null when they fit together. */
export function settingsConflict(s: AppSettings): string | null {
  const a = s.agent;
  if (a.minReviewScore > a.minApplyScore) {
    return `The review score (${a.minReviewScore}) cannot be higher than the apply score (${a.minApplyScore}) - jobs between them would be neither reviewed nor applied to.`;
  }
  if (a.minDelaySeconds > a.maxDelaySeconds) {
    return `The shortest wait between applications (${a.minDelaySeconds}s) cannot be longer than the longest (${a.maxDelaySeconds}s).`;
  }
  return null;
}
