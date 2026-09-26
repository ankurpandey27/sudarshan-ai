const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9+.#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function isPlaceholderOption(option: string): boolean {
  const o = norm(option);
  return o === '' || /^(select|choose|please select|pick|none selected)( an?)?( option| one)?$/.test(o) || /^-+$/.test(option.trim());
}

const YES = /^(yes|y|true|1|agree|i agree|accept|i accept|ok|sure|of course|absolutely)$/;
const NO = /^(no|n|false|0|disagree|decline|i decline|not)$/;

// Handles yes/no synonyms, numbers against ranges ("3-5 years", "5+", "Less than 1") and partial matches. -1 if nothing fits.
export function matchOption(value: string, options: string[]): number {
  const v = norm(value);
  if (!v) return -1;
  const candidates = options.map((o, i) => ({ i, o: norm(o), raw: o })).filter((c) => !isPlaceholderOption(c.raw));
  if (candidates.length === 0) return -1;

  const exact = candidates.find((c) => c.o === v);
  if (exact) return exact.i;

  if (YES.test(v) || NO.test(v)) {
    const want = YES.test(v);
    const hit = candidates.find((c) => (want ? /^(yes|y|true|i agree|agree|accept)\b/ : /^(no|n|false|i do not|i don t|disagree|decline)\b/).test(c.o));
    if (hit) return hit.i;
  }

  const num = Number(/^-?\d+(\.\d+)?/.exec(v)?.[0] ?? NaN);
  if (Number.isFinite(num)) {
    for (const c of candidates) {
      // Use the raw text: normalising strips the "-" in "3-5".
      if (inRange(num, c.raw)) return c.i;
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

  const starts = candidates.find((c) => c.o.startsWith(v) || v.startsWith(c.o));
  if (starts && Math.min(starts.o.length, v.length) >= 2) return starts.i;
  const contains = candidates.filter((c) => (c.o.includes(v) && v.length >= 3) || (v.includes(c.o) && c.o.length >= 3));
  if (contains.length === 1) return contains[0].i;
  if (contains.length > 1) return contains.sort((a, b) => b.o.length - a.o.length)[0].i;

  const vt = new Set(v.split(' '));
  let best = { i: -1, score: 0 };
  for (const c of candidates) {
    const ct = c.o.split(' ');
    const overlap = ct.filter((t) => vt.has(t)).length / Math.max(ct.length, vt.size);
    if (overlap > best.score) best = { i: c.i, score: overlap };
  }
  return best.score >= 0.5 ? best.i : -1;
}

export function inRange(n: number, option: string): boolean {
  const o = option.toLowerCase();
  const nums = [...o.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  if (nums.length === 0) {
    if (/\b(fresher|no experience|none)\b/.test(o)) return n === 0;
    return false;
  }
  if (nums.length >= 2 && /(-|–|to|and)/.test(o)) return n >= nums[0] && n <= nums[1];
  const [x] = nums;
  if (/(\+|or more|and above|above|more than|over|greater than|at least|minimum)/.test(o)) {
    return /(more than|over|greater than|above)/.test(o) && !/or more|and above/.test(o) ? n > x : n >= x;
  }
  if (/(less than|under|below|up to|upto|within|or less|max)/.test(o)) {
    return /(less than|under|below)/.test(o) ? n < x : n <= x;
  }
  return n === x;
}
