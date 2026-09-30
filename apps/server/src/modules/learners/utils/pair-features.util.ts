// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { canonicalSkill, extractSkills } from '../../discovery/utils/job-normalizer.util';
import { sameSubject } from '../../form-engine/utils/subject.util';
import { MEANING_FLIPS } from '../constants/learners.constants';

const kind = (q: string) =>
  /\b(years?|yrs)\b|how long/i.test(q)
    ? 'years'
    : /^(do|does|did|are|is|have|has|can|will|would)\b/i.test(q.trim())
      ? 'yesno'
      : /\b(ctc|salary|compensation|pay|lpa)\b/i.test(q)
        ? 'money'
        : 'other';
const skills = (q: string) => new Set(extractSkills(q).map(canonicalSkill));

/**
 * What tells two similar-looking questions apart, as numbers: how close in meaning, whether they are
 * about the same subject and skills, whether words that flip the meaning ("current" / "expected",
 * "10th" / "12th") differ, and whether they ask for the same kind of answer.
 */
export function pairFeatures(a: string, b: string, similarity: number): Record<string, number> {
  const A = a.toLowerCase();
  const B = b.toLowerCase();
  const flips = MEANING_FLIPS.filter((re) => re.test(A) !== re.test(B)).length;
  const sa = skills(a);
  const sb = skills(b);
  const sameSkills = sa.size === sb.size && [...sa].every((s) => sb.has(s));
  return {
    similarity,
    'very similar': similarity >= 0.9 ? 1 : 0,
    'same subject': sameSubject(a, b) && sameSubject(b, a) ? 1 : 0,
    'meaning flips': Math.min(flips, 3) / 3,
    'same kind of answer': kind(a) === kind(b) ? 1 : 0,
    'same skills': sameSkills ? 1 : 0,
  };
}

/** Two replies say the same ("30" and "30 days"); replies that tell nothing (Yes, No, N/A) are no evidence. */
export function sameReply(a: string, b: string): boolean | null {
  const tells = (x: string) => !/^(yes|no|y|n|true|false|na|n\/a|none|-|0|1|ok)\b/i.test(x.trim()) && x.trim().length > 1;
  if (!tells(a) || !tells(b)) return null;
  const norm = (x: string) =>
    x
      .toLowerCase()
      .replace(/[^a-z0-9\u00c0-\uffff@.]+/g, ' ')
      .trim();
  const nums = (x: string) => (x.match(/\d+(\.\d+)?/g) ?? []).join(',');
  return norm(a) === norm(b) || (!!nums(a) && nums(a) === nums(b));
}
