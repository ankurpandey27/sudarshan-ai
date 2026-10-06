// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { canonicalSkill, extractSkills } from '../../discovery/utils/job-normalizer.util';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'for', 'in', 'on', 'at', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'do', 'does', 'did',
  'you', 'your', 'yours', 'please', 'kindly', 'enter', 'provide', 'select', 'choose', 'mention', 'specify', 'state', 'share',
  'what', 'which', 'how', 'this', 'that', 'these', 'those', 'with', 'have', 'has', 'had', 'will', 'would', 'can', 'could',
  'if', 'any', 'our', 'we', 'us', 'me', 'my', 'i', 'and', 'or', 'as', 'by', 'it', 'its', 'from', 'about', 'here', 'below',
  'following', 'required', 'optional', 'field', 'answer', 'question', 'much', 'many', 'there', 'so', 'yet', 'e', 'g', 'eg',
]);

// Questions that differ in any of these words are never merged ("current CTC" vs "expected CTC").
const CRITICAL = new Set([
  'current', 'expected', 'previous', 'last', 'minimum', 'maximum', 'min', 'max', 'notice', 'ctc', 'salary', 'fixed',
  'variable', 'relocate', 'relocation', 'remote', 'onsite', 'hybrid', 'sponsorship', 'visa', 'authorized', 'authorised',
  'disability', 'veteran', 'gender', 'first', 'middle', 'surname', 'family', 'given', 'full', 'city', 'state', 'country',
  'zip', 'postal', 'code', 'street', 'address', 'email', 'phone', 'mobile', 'linkedin', 'github', 'portfolio', 'website',
  'month', 'months', 'year', 'years', 'day', 'days', 'hour', 'hours', 'lakh', 'lakhs', 'lpa', 'not', 'no', 'never',
  'bachelor', 'master', 'degree', 'cgpa', 'gpa', 'percentage', '10th', '12th', 'graduation', 'postgraduation',
]);

const stem = (w: string): string => {
  if (w.length <= 4) return w;
  return w.replace(/(ing|ed|es|s)$/, '');
};

export function questionTokens(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/\((?:required|optional)\)|\*/g, ' ')
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .replace(/(?<![a-z0-9])\.|\.(?![a-z0-9])/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .map((w) => (CRITICAL.has(w) ? w : stem(w)));
}

export function questionKey(question: string): string {
  return questionTokens(question).join(' ').slice(0, 300);
}

// 0 when the questions differ in a meaning-changing word, a number or the skill asked about.
export function questionSimilarity(a: string, b: string): number {
  const ta = new Set(questionTokens(a));
  const tb = new Set(questionTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  for (const token of symmetricDifference(ta, tb)) {
    if (CRITICAL.has(token) || /\d/.test(token)) return 0;
  }
  const sa = new Set(extractSkills(a).map(canonicalSkill));
  const sb = new Set(extractSkills(b).map(canonicalSkill));
  if (sa.size + sb.size > 0 && symmetricDifference(sa, sb).size > 0) return 0;
  let inter = 0;
  for (const token of ta) if (tb.has(token)) inter++;
  return inter / (ta.size + tb.size - inter);
}

function symmetricDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set<T>();
  for (const x of a) if (!b.has(x)) out.add(x);
  for (const x of b) if (!a.has(x)) out.add(x);
  return out;
}
