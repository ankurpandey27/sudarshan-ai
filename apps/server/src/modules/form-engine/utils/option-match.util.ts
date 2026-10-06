// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9+.#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function isPlaceholderOption(option: string): boolean {
  const normalized = norm(option);
  return normalized === '' || /^(select|choose|please select|pick|none selected)( an?)?( option| one)?$/.test(normalized) || /^-+$/.test(option.trim());
}

const YES = /^(yes|y|true|1|agree|i agree|accept|i accept|ok|sure|of course|absolutely)$/;
const NO = /^(no|n|nope|nah|false|0|disagree|decline|i decline|not)$/;
// Choosing not to answer, however a form words it.
const DECLINE =
  /prefer not|rather not|decline|do not wish|don t wish|not wish to|choose not|not to (say|answer|disclose|self identify)|not disclos|no answer|wish not/;

// Handles yes/no synonyms, numbers against ranges ("3-5 years", "5+", "Less than 1") and partial matches. -1 if nothing fits.
export function matchOption(value: string, options: string[]): number {
  const wanted = norm(value);
  if (!wanted) return -1;
  const candidates = options.map((o, i) => ({ i, o: norm(o), raw: o })).filter((c) => !isPlaceholderOption(c.raw));
  if (candidates.length === 0) return -1;

  const exact = candidates.find((c) => c.o === wanted);
  if (exact) return exact.i;

  // "Prefer not to say" in the site's own words: "I don't wish to answer", "Decline to self-identify" (Greenhouse, 2026-10-01).
  if (DECLINE.test(wanted)) {
    const hit = candidates.find((c) => DECLINE.test(c.o));
    if (hit) return hit.i;
  }

  if (YES.test(wanted) || NO.test(wanted)) {
    const want = YES.test(wanted);
    const hit = candidates.find((c) => (want ? /^(yes|y|true|i agree|agree|accept)\b/ : /^(no|n|false|i do not|i don t|disagree|decline)\b/).test(c.o));
    if (hit) return hit.i;
  }

  const num = Number(/^-?\d+(\.\d+)?/.exec(wanted)?.[0] ?? NaN);
  if (Number.isFinite(num)) {
    for (const candidate of candidates) {
      // Use the raw text: normalising strips the "-" in "3-5".
      if (inRange(num, candidate.raw)) return candidate.i;
    }
    const sameNumber = candidates.find((c) => new RegExp(`(^|[^0-9.])${num}([^0-9.]|$)`).test(c.o));
    if (sameNumber) return sameNumber.i;
  }

  // "+91" -> "India (+91)"
  if (/^\+\d{1,4}$/.test(value.trim())) {
    const code = value.trim();
    const hit = candidates.find((c) => c.raw.includes(`(${code})`) || c.raw.endsWith(code) || c.raw.startsWith(code));
    if (hit) return hit.i;
  }

  // Whole words only: "new delhi" fits "new delhi india", but "noida" must not fit "no".
  const wordPrefix = (long: string, short: string) => long === short || long.startsWith(`${short} `);
  const starts = candidates.find((c) => wordPrefix(c.o, wanted) || wordPrefix(wanted, c.o));
  if (starts && Math.min(starts.o.length, wanted.length) >= 2) return starts.i;
  const contains = candidates.filter((c) => (c.o.includes(wanted) && wanted.length >= 3) || (wanted.includes(c.o) && c.o.length >= 3));
  if (contains.length === 1) return contains[0].i;
  if (contains.length > 1) return contains.sort((a, b) => b.o.length - a.o.length)[0].i;

  const vt = new Set(wanted.split(' '));
  let best = { i: -1, score: 0 };
  for (const candidate of candidates) {
    const ct = candidate.o.split(' ');
    const overlap = ct.filter((t) => vt.has(t)).length / Math.max(ct.length, vt.size);
    if (overlap > best.score) best = { i: candidate.i, score: overlap };
  }
  return best.score >= 0.5 ? best.i : -1;
}

export function inRange(n: number, option: string): boolean {
  const lower = option.toLowerCase();
  const nums = [...lower.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  if (nums.length === 0) {
    if (/\b(fresher|no experience|none)\b/.test(lower)) return n === 0;
    return false;
  }
  if (nums.length >= 2 && /(-|–|to|and)/.test(lower)) return n >= nums[0] && n <= nums[1];
  const [x] = nums;
  if (/(\+|or more|and above|above|more than|over|greater than|at least|minimum)/.test(lower)) {
    return /(more than|over|greater than|above)/.test(lower) && !/or more|and above/.test(lower) ? n > x : n >= x;
  }
  if (/(less than|under|below|up to|upto|within|or less|max)/.test(lower)) {
    return /(less than|under|below)/.test(lower) ? n < x : n <= x;
  }
  return n === x;
}
