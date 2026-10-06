// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AppSettings } from '../interfaces/app-settings.interface';

/** Settings that are each valid but contradict each other, explained; null when they fit together. */
export function settingsConflict(s: AppSettings): string | null {
  const agent = s.agent;
  if (agent.minReviewScore > agent.minApplyScore) {
    return `The review score (${agent.minReviewScore}) cannot be higher than the apply score (${agent.minApplyScore}) - jobs between them would be neither reviewed nor applied to.`;
  }
  if (agent.minDelaySeconds > agent.maxDelaySeconds) {
    return `The shortest wait between applications (${agent.minDelaySeconds}s) cannot be longer than the longest (${agent.maxDelaySeconds}s).`;
  }
  return null;
}
