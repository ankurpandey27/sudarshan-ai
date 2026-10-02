// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AppSettings, SourcesSettings } from '../interfaces/app-settings.interface';
import { SAFE_ACTIVE_HOURS, SAFE_DAILY, SAFE_MIN_GAP_SECONDS, SOURCE_SETTING_NAMES } from '../constants/safe-pace.constants';

/** The settings that could get an account restricted, in plain words; empty when the pace is safe. */
export function paceRisks(s: AppSettings): string[] {
  const out: string[] = [];
  for (const k of Object.keys(SAFE_DAILY) as (keyof SourcesSettings)[]) {
    const src = s.sources[k];
    if (src?.enabled && src.dailyLimit > SAFE_DAILY[k]) out.push(`${SOURCE_SETTING_NAMES[k]} ${src.dailyLimit} a day (safe: up to ${SAFE_DAILY[k]})`);
  }
  if (s.agent.minDelaySeconds < SAFE_MIN_GAP_SECONDS) out.push(`${s.agent.minDelaySeconds} s between applications (safe: at least ${SAFE_MIN_GAP_SECONDS} s)`);
  const hours = (s.agent.activeHoursEnd - s.agent.activeHoursStart + 24) % 24 || 24;
  if (hours > SAFE_ACTIVE_HOURS) out.push(`active ${hours} hours a day`);
  return out;
}
