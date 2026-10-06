// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { extractSkills } from '../../discovery/utils/job-normalizer.util';
import { resolveCities } from '../../scoring/utils/geo.util';
import { CandidateProfile } from '../interfaces/candidate-profile.interface';

const ROLE_WORDS = /\b(engineer|developer|programmer|architect|manager|analyst|designer|consultant|scientist|lead|specialist|administrator|tester|devops|sre)\b/i;

const NOT_A_NAME =
  /\b(resume|curriculum|vitae|summary|profile|experience|education|skills?|projects?|contact|objective|certifications?|achievements|design|development|management|architecture|automation|services?|system|systems|performance|optimization|product|engineering|reliability|scalability|backend|frontend|full|stack|cloud|data|software|web|api|apis|workflow|lifecycle|solutions?|technical|senior|junior)\b/i;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};
const MONTH = String.raw`(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?`;
const DATE = String.raw`(?:${MONTH}\s*[',]?\s*)?((?:19|20)\d{2})|(\d{1,2})\s*/\s*((?:19|20)\d{2})`;
const RANGE = new RegExp(
  String.raw`(?:${DATE})\s*(?:-|–|—|to|till|until)\s*(?:(present|current|now|today|date)|(?:${DATE}))`,
  'gi',
);

export function parseResumeHeuristically(text: string, now = new Date()): Partial<CandidateProfile> {
  const out: Partial<CandidateProfile> = {};
  const email = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.exec(text)?.[0];
  if (email) out.email = email.toLowerCase();

  const phone = /(?:\+?(\d{1,3})[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,5}/.exec(
    text.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, ' '),
  );
  if (phone) {
    const digits = phone[0].replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 13) {
      out.phone = digits.slice(-10);
      if (digits.length > 10) out.phoneCountryCode = `+${digits.slice(0, digits.length - 10)}`;
    }
  }

  const linkedin = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[a-z0-9_%-]+\/?/i.exec(text)?.[0];
  if (linkedin) out.linkedinUrl = withScheme(linkedin);
  const github = /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-z0-9-]+\/?/i.exec(text)?.[0];
  if (github) out.githubUrl = withScheme(github);
  const portfolio = [...text.matchAll(/https?:\/\/[^\s)>\]|,]+/gi)]
    .map((m) => m[0])
    .find((u) => !/linkedin\.com|github\.com|mailto:/i.test(u));
  if (portfolio) out.portfolioUrl = portfolio;

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const nameAt = findNameLine(lines, email);
  const name = nameAt >= 0 ? lines[nameAt] : guessNameFromEmail(email);
  if (name) {
    const parts = name.replace(/[|•·,]/g, ' ').trim().split(/\s+/);
    out.firstName = titleCase(parts[0]);
    out.lastName = titleCase(parts.slice(1).join(' '));
  }

  // The title is usually the line after the name, or part of the header line.
  const header = [...lines.slice(0, 6), ...(nameAt >= 0 ? lines.slice(nameAt, nameAt + 3) : [])].join(' | ');
  const afterName = nameAt >= 0 ? lines[nameAt + 1] : undefined;
  const title =
    (afterName && ROLE_WORDS.test(afterName) && afterName.length < 70 ? afterName : undefined) ??
    header
      .split(/[|•·]/)
      .map((s) => s.trim())
      .find((s) => ROLE_WORDS.test(s) && s.length < 60 && !/@|\d{5}/.test(s));
  if (title) {
    out.currentTitle = title === title.toUpperCase() ? titleCase(title) : title;
    out.headline = out.currentTitle;
  }
  const city = resolveCities(header)[0];
  if (city) {
    out.city = titleCase(city.name);
    out.country = titleCase(city.country);
  }

  out.skills = extractSkills(text).map((s) => ({ name: s, years: null }));

  // "5+ yrs of experience", "nearly 5 years of backend experience"
  const stated = /(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+[a-z-]+){0,3}?\s+experience/i.exec(text);
  const fromRanges = yearsFromDateRanges(text, now);
  const years = stated ? Number(stated[1]) : fromRanges;
  if (years > 0 && years < 50) out.totalYearsExperience = Math.round(years * 10) / 10;

  return out;
}

// Overlapping ranges are counted once.
export function yearsFromDateRanges(text: string, now = new Date()): number {
  const spans: [number, number][] = [];
  for (const match of text.matchAll(RANGE)) {
    const start = toMonthIndex(match[1], match[2], match[3], match[4]);
    const end = match[5] ? now.getFullYear() * 12 + now.getMonth() : toMonthIndex(match[6], match[7], match[8], match[9], true);
    if (start === null || end === null || end < start) continue;
    spans.push([start, end]);
  }
  if (spans.length === 0) return 0;
  const earliestWork = detectFirstWorkMonth(text);
  const merged = spans
    .filter(([s]) => earliestWork === null || s >= earliestWork)
    .sort((a, b) => a[0] - b[0])
    .reduce<[number, number][]>((acc, span) => {
      const last = acc[acc.length - 1];
      if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
      else acc.push([...span]);
      return acc;
    }, []);
  const months = merged.reduce((sum, [s, e]) => sum + (e - s + 1), 0);
  return months / 12;
}

function toMonthIndex(
  month: string | undefined,
  year: string | undefined,
  numMonth: string | undefined,
  numYear: string | undefined,
  isEnd = false,
): number | null {
  if (year) {
    const monthIndex = month ? MONTHS[month.toLowerCase().slice(0, month.toLowerCase().startsWith('sept') ? 4 : 3)] : undefined;
    return Number(year) * 12 + (monthIndex ?? (isEnd ? 11 : 0));
  }
  if (numMonth && numYear) {
    const monthIndex = Number(numMonth) - 1;
    if (monthIndex < 0 || monthIndex > 11) return null;
    return Number(numYear) * 12 + monthIndex;
  }
  return null;
}

// Ranges before the first one under "Experience" are education.
function detectFirstWorkMonth(text: string): number | null {
  const lower = text.toLowerCase();
  const expAt = lower.search(/(^|\n)\s*(work\s+experience|professional\s+experience|experience|employment)\b/);
  const eduAt = lower.search(/(^|\n)\s*(education|academics?|qualifications?)\b/);
  if (expAt === -1 || eduAt === -1) return null;
  const expText = text.slice(expAt, eduAt > expAt ? eduAt : undefined);
  let earliest: number | null = null;
  for (const match of expText.matchAll(RANGE)) {
    const start = toMonthIndex(match[1], match[2], match[3], match[4]);
    if (start !== null && (earliest === null || start < earliest)) earliest = start;
  }
  return earliest;
}

const nameShaped = (line: string): boolean => {
  const words = line.replace(/[|•·,]/g, ' ').trim().split(/\s+/);
  return words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-Za-z][A-Za-z.'-]*$/.test(w));
};

// Prefer a line the email spells out ("PRIYA SHARMA" / priyasharma91@...): PDF text order
// often puts a sidebar first. Otherwise take the first name-shaped line near the top.
function findNameLine(lines: string[], email?: string): number {
  const emailLetters = (email ?? '').split('@')[0].toLowerCase().replace(/[^a-z]/g, '');
  if (emailLetters.length >= 5) {
    const hit = lines.findIndex((l) => {
      if (!nameShaped(l)) return false;
      const letters = l.toLowerCase().replace(/[^a-z]/g, '');
      return letters.length >= 5 && emailLetters.includes(letters);
    });
    if (hit >= 0) return hit;
  }
  return lines.slice(0, 8).findIndex(
    (l) =>
      nameShaped(l) &&
      !NOT_A_NAME.test(l) &&
      !ROLE_WORDS.test(l) &&
      extractSkills(l).length === 0,
  );
}

// "priya.sharma@..." -> "priya sharma"
function guessNameFromEmail(email?: string): string | null {
  if (!email) return null;
  const parts = email.split('@')[0].replace(/\d+/g, '').split(/[._-]/).filter((p) => p.length > 1);
  return parts.length >= 2 ? parts.slice(0, 2).join(' ') : null;
}

const titleCase = (s: string): string =>
  s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

const withScheme = (url: string): string => (/^https?:\/\//i.test(url) ? url : `https://${url}`).replace(/\/$/, '');
