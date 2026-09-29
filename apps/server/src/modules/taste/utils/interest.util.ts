// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import {
  AVOID_PENALTY,
  COVERED_AT,
  FULL_AFFINITY_SHARE,
  INTEREST_WEIGHTS,
  REASONS_SHOWN,
  SKILL_COVERAGE_WEIGHT,
  SKIP_MIN_DECISIONS,
  SKIP_MIN_RATE,
  TOP_SKILLS_COUNTED,
  UNKNOWN_PART,
} from '../constants/taste.constants';
import { canonicalSkill, extractSkills } from '../../discovery/utils/job-normalizer.util';
import { InterestProfile, TasteFeaturesInput, TastePrediction } from '../interfaces/taste.interface';
import { tasteWords } from './taste-features.util';

type Kind = keyof typeof INTEREST_WEIGHTS;

/** Every skill the job asks for - the ones you have, the ones you do not, and any named in its title ("Node Js SE"). */
export function jobSkills(job: TasteFeaturesInput): string[] {
  const d = job.detail;
  const listed = [...(d?.matchedSkills ?? []), ...(d?.missingSkills ?? []), ...extractSkills(job.title)];
  return [...new Set(listed.map((s) => canonicalSkill(s)).filter(Boolean))];
}

function traits(job: TasteFeaturesInput): Record<Kind, string[]> {
  return { skill: jobSkills(job), title: tasteWords(job.title), platform: [job.platform] };
}

const key = (kind: Kind, value: string) => `${kind}: ${value}`;

/**
 * What the jobs you kept have in common: for each skill, title word and platform, how often it was
 * there, relative to the most common one of its kind. Anything in at least half as many of your
 * applications as your top skill counts as fully liked. Also: what you really turn down.
 */
export function buildProfile(rows: { y: 0 | 1; job: TasteFeaturesInput }[]): InterestProfile {
  const kept = rows.filter((r) => r.y === 1);
  const counts = new Map<string, number>();
  for (const r of kept) {
    const t = traits(r.job);
    for (const kind of Object.keys(t) as Kind[]) for (const v of t[kind]) counts.set(key(kind, v), (counts.get(key(kind, v)) ?? 0) + 1);
  }
  const top: Record<Kind, number> = { skill: 0, title: 0, platform: 0 };
  for (const [k, n] of counts) {
    const kind = k.slice(0, k.indexOf(':')) as Kind;
    top[kind] = Math.max(top[kind], n);
  }
  const affinity: Record<string, number> = {};
  for (const [k, n] of counts) {
    const kind = k.slice(0, k.indexOf(':')) as Kind;
    affinity[k] = Math.min(1, n / Math.max(1, top[kind] * FULL_AFFINITY_SHARE));
  }

  // Turned down at least half the time, over enough decisions: a real dislike, not noise.
  const tally = new Map<string, { kept: number; skipped: number }>();
  for (const r of rows) {
    const t = traits(r.job);
    for (const kind of Object.keys(t) as Kind[]) {
      for (const v of t[kind]) {
        const c = tally.get(key(kind, v)) ?? { kept: 0, skipped: 0 };
        if (r.y === 1) c.kept++;
        else c.skipped++;
        tally.set(key(kind, v), c);
      }
    }
  }
  const avoided: Record<string, number> = {};
  for (const [k, c] of tally) {
    const total = c.kept + c.skipped;
    if (total >= SKIP_MIN_DECISIONS && c.skipped / total >= SKIP_MIN_RATE) avoided[k] = c.skipped / total;
  }
  return { kept: kept.length, affinity, avoided };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * How much this job looks like the ones you apply to, 0-1, with reasons: its skills matter most
 * (your best matches, and how many of its skills are ones you go for), then its title and platform.
 * Something you really turn down pulls it down.
 */
export function interestOf(profile: InterestProfile, job: TasteFeaturesInput): TastePrediction {
  const t = traits(job);
  const aff = (kind: Kind, v: string) => profile.affinity[key(kind, v)] ?? 0;

  // What a job does not say (no skills listed, a title in another script) is unknown - the middle - not a match.
  const parts: { kind: Kind; value: number }[] = [];
  if (t.skill.length) {
    const scores = t.skill.map((s) => aff('skill', s)).sort((a, b) => b - a);
    const best = mean(scores.slice(0, TOP_SKILLS_COUNTED));
    const covered = scores.filter((s) => s >= COVERED_AT).length / scores.length;
    parts.push({ kind: 'skill', value: best * (1 - SKILL_COVERAGE_WEIGHT) + covered * SKILL_COVERAGE_WEIGHT });
  } else {
    parts.push({ kind: 'skill', value: UNKNOWN_PART });
  }
  parts.push({ kind: 'title', value: t.title.length ? mean(t.title.map((w) => aff('title', w))) : UNKNOWN_PART });
  parts.push({ kind: 'platform', value: aff('platform', job.platform) });

  let p = parts.reduce((s, x) => s + INTEREST_WEIGHTS[x.kind] * x.value, 0);

  const against = (Object.keys(t) as Kind[]).flatMap((kind) => t[kind].map((v) => key(kind, v))).filter((k) => profile.avoided[k] !== undefined);
  const worst = Math.max(0, ...against.map((k) => profile.avoided[k]));
  p *= 1 - AVOID_PENALTY * worst;

  // Reasons: what it shares with your applications (skills first), then what counts against it.
  const shared = (Object.keys(t) as Kind[])
    .flatMap((kind) => t[kind].map((v) => ({ k: key(kind, v), a: aff(kind, v), kind })))
    .filter((x) => x.a >= COVERED_AT && !against.includes(x.k))
    .sort((a, b) => Number(b.kind === 'skill') - Number(a.kind === 'skill') || b.a - a.a)
    .map((x) => `+ ${x.k}`);
  const unlike = against.sort((a, b) => profile.avoided[b] - profile.avoided[a]).map((k) => `- ${k}`);
  // A job mostly about skills you never apply for says so.
  const lowSkills = t.skill.length > 0 && parts[0].value < COVERED_AT;
  const foreign = p < 0.5 || lowSkills ? t.skill.filter((s) => aff('skill', s) < COVERED_AT).map((s) => `- skill: ${s}`) : [];
  // A low score leads with what holds it back; a high one with what it shares with your applications.
  const reasons = (p < 0.5 ? [...unlike, ...foreign, ...shared] : [...unlike, ...shared, ...foreign]).slice(0, REASONS_SHOWN);
  return { p: Math.round(Math.max(0, Math.min(1, p)) * 100) / 100, reasons };
}
