// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { UpdateProfileDto } from '../../profile/dto/update-profile.dto';
import { UpdateSettingsDto } from '../../settings/dto/update-settings.dto';
import { AgentMode } from '../../settings/enums/agent-mode.enum';

const list = (v: string): string[] =>
  v
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
const bool = (v: string): boolean | null => (/^(y|yes|true|1|on)$/i.test(v.trim()) ? true : /^(n|no|false|0|off)$/i.test(v.trim()) ? false : null);
const int = (v: string): number | null => {
  const n = Number(v.replace(/[, ]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
};
// "18 LPA" -> 1800000; plain numbers are taken as-is.
const money = (v: string): number | null => {
  const match = /([\d.,]+)\s*(l|lpa|lakh|lakhs|lac|lacs|cr|crore)?/i.exec(v);
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const unit = (match[2] ?? '').toLowerCase();
  return Math.round(unit.startsWith('c') ? n * 1e7 : unit ? n * 1e5 : n);
};

export function mapPreferences(rows: { key: string; value: string }[]): {
  settings: UpdateSettingsDto;
  profile: UpdateProfileDto;
  applied: string[];
  warnings: string[];
} {
  const settings: UpdateSettingsDto = {};
  const profile: UpdateProfileDto = {};
  const applied: string[] = [];
  const warnings: string[] = [];
  const search = (settings.search ??= {});
  const agent = (settings.agent ??= {});
  const sources = (settings.sources ??= {});

  for (const { key, value } of rows) {
    const k = key
      .toLowerCase()
      .replace(/[^a-z ]/g, '')
      .trim();
    const trimmed = value.trim();
    if (!trimmed) continue;
    let ok = true;
    if (/^(keywords?|job titles?|roles?)$/.test(k)) search.keywords = list(trimmed);
    else if (/^(locations?|cities)$/.test(k)) search.locations = list(trimmed);
    else if (/remote only/.test(k)) ok = (search.remoteOnly = bool(trimmed) ?? undefined) !== undefined;
    else if (/easy apply/.test(k)) ok = (search.easyApplyOnly = bool(trimmed) ?? undefined) !== undefined;
    else if (/posted within/.test(k)) ok = (search.postedWithinDays = int(trimmed) ?? undefined) !== undefined;
    else if (/exclude compan/.test(k)) search.excludeCompanies = list(trimmed);
    else if (/exclude title/.test(k)) search.excludeTitleWords = list(trimmed);
    else if (/^mode$/.test(k)) ok = (agent.mode = /auto/i.test(trimmed) ? AgentMode.AUTO : /review/i.test(trimmed) ? AgentMode.REVIEW : undefined) !== undefined;
    else if (/min(imum)? apply score/.test(k)) ok = (agent.minApplyScore = int(trimmed) ?? undefined) !== undefined;
    else if (/linkedin daily/.test(k)) ok = (sources.linkedin = { dailyLimit: int(trimmed) ?? undefined }).dailyLimit !== undefined;
    else if (/naukri daily/.test(k)) ok = (sources.naukri = { dailyLimit: int(trimmed) ?? undefined }).dailyLimit !== undefined;
    else if (/notice/.test(k)) ok = (profile.noticePeriodDays = int(trimmed) ?? undefined) !== undefined;
    else if (/current ctc|current salary/.test(k)) ok = (profile.currentCtc = money(trimmed) ?? undefined) !== undefined;
    else if (/expected ctc|expected salary/.test(k)) ok = (profile.expectedCtc = money(trimmed) ?? undefined) !== undefined;
    else if (/relocat/.test(k)) ok = (profile.willingToRelocate = bool(trimmed) ?? undefined) !== undefined;
    else ok = false;
    if (ok) applied.push(key);
    else warnings.push(`Preference "${key}" = "${value}" was not understood`);
  }
  return { settings, profile, applied, warnings };
}
