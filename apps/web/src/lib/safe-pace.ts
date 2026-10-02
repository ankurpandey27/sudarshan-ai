// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import type { Settings } from './types';

type SourceKey = keyof Settings['sources'];

/** Above these, job sites start to notice: accounts get warnings, captchas, or are restricted. */
export const SAFE_DAILY: Record<SourceKey, number> = {
  linkedin: 30,
  naukri: 50,
  indeed: 20,
  instahyre: 40,
  foundit: 30,
  hirist: 30,
  himalayas: 30,
  links: 40,
  externalSites: 30,
};
const SAFE_MIN_GAP = 30;
const SAFE_GAP_SPREAD = 30;
const SAFE_ACTIVE_HOURS = 16;
const SITE_NAMES: Record<SourceKey, string> = {
  linkedin: 'LinkedIn',
  naukri: 'Naukri',
  indeed: 'Indeed',
  instahyre: 'Instahyre',
  foundit: 'Foundit',
  hirist: 'Hirist',
  himalayas: 'Himalayas',
  links: 'Other career sites',
  externalSites: 'Company career sites',
};

export function overSafeDaily(s: Settings, k: SourceKey): boolean {
  return s.sources[k].enabled && s.sources[k].dailyLimit > SAFE_DAILY[k];
}

/** Plain-words reasons the current pace could get an account restricted; empty when it is safe. */
export function paceWarnings(s: Settings): string[] {
  const out: string[] = [];
  for (const k of Object.keys(SAFE_DAILY) as SourceKey[]) {
    if (overSafeDaily(s, k)) out.push(`${SITE_NAMES[k]}: ${s.sources[k].dailyLimit} a day (safe: up to ${SAFE_DAILY[k]})`);
  }
  if (s.agent.minDelaySeconds < SAFE_MIN_GAP) out.push(`${s.agent.minDelaySeconds} s between applications (safe: at least ${SAFE_MIN_GAP} s)`);
  else if (s.agent.maxDelaySeconds - s.agent.minDelaySeconds < SAFE_GAP_SPREAD) out.push('Gaps that are nearly always the same length look like a robot');
  const hours = (s.agent.activeHoursEnd - s.agent.activeHoursStart + 24) % 24 || 24;
  if (hours > SAFE_ACTIVE_HOURS) out.push(`Active ${hours} hours a day - applying through the night looks like a robot`);
  return out;
}

/** The same settings at a pace a person could keep up: only what is over the safe level changes. */
export function safePace(s: Settings): Settings {
  const sources = { ...s.sources };
  for (const k of Object.keys(SAFE_DAILY) as SourceKey[]) {
    sources[k] = { ...sources[k], dailyLimit: Math.min(sources[k].dailyLimit, SAFE_DAILY[k]) };
  }
  const minDelaySeconds = Math.max(s.agent.minDelaySeconds, 40);
  const maxDelaySeconds = Math.max(s.agent.maxDelaySeconds, minDelaySeconds + 70);
  const hours = (s.agent.activeHoursEnd - s.agent.activeHoursStart + 24) % 24 || 24;
  const active = hours > SAFE_ACTIVE_HOURS ? { activeHoursStart: 8, activeHoursEnd: 23 } : {};
  return { ...s, sources, agent: { ...s.agent, minDelaySeconds, maxDelaySeconds, ...active } };
}
