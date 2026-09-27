// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { canonicalSkill } from '../../discovery/utils/job-normalizer.util';
import { CandidateProfile, ProfileSkill } from '../interfaces/candidate-profile.interface';

export function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '' || v === 0 || (Array.isArray(v) && v.length === 0);
}

// Models return "5" for 5 and similar; coerce to the profile's types.
export function sanitizeAi(ai: Partial<CandidateProfile>): Partial<CandidateProfile> {
  const out: Partial<CandidateProfile> = {};
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
  for (const k of [
    'firstName', 'lastName', 'email', 'phoneCountryCode', 'city', 'state', 'country', 'postalCode',
    'headline', 'currentTitle', 'currentCompany', 'linkedinUrl', 'githubUrl', 'portfolioUrl', 'summary',
  ] as const) {
    const v = str(ai[k]);
    if (v) (out as Record<string, unknown>)[k] = v;
  }
  const phone = str(ai.phone).replace(/\D/g, '');
  if (phone.length >= 10) out.phone = phone.slice(-10);
  const years = Number(ai.totalYearsExperience);
  if (Number.isFinite(years) && years > 0 && years < 50) out.totalYearsExperience = Math.round(years * 10) / 10;
  if (Array.isArray(ai.skills)) {
    out.skills = ai.skills
      .map((s): ProfileSkill => (typeof s === 'string' ? { name: s, years: null } : { name: str(s?.name), years: toNum(s?.years) }))
      .filter((s) => s.name.length > 0 && s.name.length < 60);
  }
  if (Array.isArray(ai.education)) out.education = ai.education.filter((e) => e && typeof e === 'object');
  if (Array.isArray(ai.experience)) out.experience = ai.experience.filter((e) => e && typeof e === 'object');
  if (Array.isArray(ai.languages)) out.languages = ai.languages.map(str).filter(Boolean);
  return out;
}

// AI values win; keep contact details it missed and union the skills.
export function mergeExtracted(basic: Partial<CandidateProfile>, ai: Partial<CandidateProfile>): Partial<CandidateProfile> {
  const merged: Partial<CandidateProfile> = { ...basic, ...ai };
  const seen = new Set<string>();
  merged.skills = [...(ai.skills ?? []), ...(basic.skills ?? [])].filter((s) => {
    const key = canonicalSkill(s.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return merged;
}

function toNum(v: unknown): number | null {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n;
}
