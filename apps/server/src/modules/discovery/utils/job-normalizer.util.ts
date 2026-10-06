// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { SKILL_ALIASES, SKILL_DICTIONARY } from '../constants/skills.constants';
import { escapeRegex } from '../../../common/utils/regex.util';

const CURRENCY = String.raw`(₹|rs\.?|inr|\$|usd)`;
const AMOUNT = String.raw`(\d[\d,]*(?:\.\d+)?)`;
const UNIT = String.raw`(k|lpa|lacs?|lakhs?|l|cr|crores?)`;
const PERIOD = String.raw`(?:\s*(?:\/|per)\s*(yr|year|annum|month|mo|hr|hour))?`;
// "$120K/yr - $150K/yr", "₹10,00,000/yr - ₹15,00,000/yr", "12-20 Lacs PA", "₹ 8-12 LPA"
const SALARY_RANGE = new RegExp(
  String.raw`${CURRENCY}?\s*${AMOUNT}\s*${UNIT}?\b${PERIOD}\s*(?:[–—-]|to)\s*${CURRENCY}?\s*${AMOUNT}\s*${UNIT}?\b${PERIOD}`,
  'i',
);
const UNIT_MULTIPLIER: Record<string, number> = {
  k: 1e3,
  l: 1e5,
  lpa: 1e5,
  lac: 1e5,
  lacs: 1e5,
  lakh: 1e5,
  lakhs: 1e5,
  cr: 1e7,
  crore: 1e7,
  crores: 1e7,
};

export const canonicalSkill = (skill: string): string => {
  const lower = skill.toLowerCase().trim();
  return SKILL_ALIASES[lower] ?? lower;
};

// Whole-token matches only: "go" must not match "good", "ai" not "email".
const SKILL_MATCHERS = [...SKILL_DICTIONARY, 'nodejs', 'reactjs', 'nest.js'].map((skill) => ({
  skill,
  re: new RegExp(`(?<![a-z0-9])${escapeRegex(skill)}(?![a-z0-9])`, 'i'),
}));

export function extractSkills(description: string): string[] {
  const found = new Set<string>();
  for (const { skill, re } of SKILL_MATCHERS) {
    if (re.test(description)) {
      found.add(canonicalSkill(skill));
    }
  }
  return [...found];
}

// Annual range in the posting's currency. Needs a currency or unit (so "2-5 years" is ignored); hourly rates are skipped.
export function parseSalary(raw: string | null): { min: number | null; max: number | null } {
  const none = { min: null, max: null };
  if (!raw) return none;
  const match = SALARY_RANGE.exec(raw.replace(/\u00a0/g, ' '));
  if (!match) return none;
  const [, cur1, a1, unit1, period1, cur2, a2, unit2, period2] = match;
  if (!(cur1 || cur2 || unit1 || unit2)) return none; // not money
  const period = (period2 ?? period1 ?? '').toLowerCase();
  if (period === 'hr' || period === 'hour') return none;
  const perYear = period === 'month' || period === 'mo' ? 12 : 1;
  // In "12-20 Lacs" the unit applies to both ends.
  const mult = (u?: string) => UNIT_MULTIPLIER[(u ?? '').toLowerCase()] ?? 1;
  const min = Number(a1.replace(/,/g, '')) * mult(unit1 ?? unit2) * perYear;
  const max = Number(a2.replace(/,/g, '')) * mult(unit2 ?? unit1) * perYear;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < 1000) return none;
  return min <= max ? { min, max } : { min: max, max: min };
}

// Hybrid is not remote, and a description that only mentions "remote teams" does not count.
export function detectRemote(location: string, description = ''): boolean {
  const loc = location.toLowerCase();
  if (/\bhybrid\b/.test(loc)) return false;
  if (/\bremote\b|work from home|\bwfh\b|anywhere/.test(loc)) return true;
  return /\b(fully|100%|completely) remote\b|\bremote[- ]first\b|\bremote(?:ly)? \(anywhere|\bpermanent(?:ly)? work from home\b/i.test(description);
}
