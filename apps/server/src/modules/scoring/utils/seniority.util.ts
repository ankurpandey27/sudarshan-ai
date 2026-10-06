// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AUTO_LEVEL_CAP, JUNIOR_TITLE, MAX_YEARS_ASKED, SENIOR_TITLE } from '../constants/seniority.constants';

/** The experience a job asks for, when it says: "3-7 years", "3 to 5 yrs", "5+ years", "minimum 2 years". */
export interface YearsAsked {
  min: number;
  /** null when open-ended ("5+ years", "minimum 3 years"). */
  max: number | null;
}

const RANGE = /(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/gi;
// Naukri's addresses: ".../job-listings-...-3-to-7-years-2109..."
const URL_RANGE = /-(\d{1,2})-to-(\d{1,2})-years?\b/i;
const OPEN = /(?:(\d{1,2})\s*\+\s*(?:years?|yrs?)|(?:minimum(?: of)?|at least|min\.?)\s*(\d{1,2})\s*(?:years?|yrs?))\b/gi;

/** Every figure in a text: ranges and open-ended ("5+ years"), in order. */
function figures(text: string): YearsAsked[] {
  const out: YearsAsked[] = [];
  for (const range of text.matchAll(RANGE)) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    if (low <= high && high <= MAX_YEARS_ASKED) out.push({ min: low, max: high });
  }
  for (const openEnded of text.matchAll(OPEN)) {
    const n = Number(openEnded[1] ?? openEnded[2]);
    if (n <= MAX_YEARS_ASKED) out.push({ min: n, max: null });
  }
  return out;
}

/** The highest of several figures: an open-ended one counts as at least its minimum and above. */
function highest(list: YearsAsked[]): YearsAsked | null {
  if (!list.length) return null;
  const top = (y: YearsAsked) => (y.max === null ? Math.max(y.min, 1) + 100 : y.max);
  return list.reduce((a, b) => (top(b) > top(a) ? b : a));
}

/**
 * What the job asks for. The title or the job's address, when they say, decide; otherwise the start of
 * its description - taking its highest figure, since "5+ years overall, 1-2 years with Docker" is a 5+ job.
 */
export function yearsAsked(title: string, url: string, description: string): YearsAsked | null {
  const inTitle = highest(figures(title));
  if (inTitle) return inTitle;
  const match = URL_RANGE.exec(url);
  if (match && Number(match[1]) <= Number(match[2]) && Number(match[2]) <= MAX_YEARS_ASKED) return { min: Number(match[1]), max: Number(match[2]) };
  return highest(figures(description.slice(0, 4000)));
}

/** The level below which jobs are skipped: yours if set, else your experience minus a year, at most 3 (0 for a fresher). */
export function levelFor(setting: number | null | undefined, yourYears: number): number {
  if (setting !== null && setting !== undefined) return Math.max(0, setting);
  return Math.max(0, Math.min(AUTO_LEVEL_CAP, Math.floor(yourYears) - 1));
}

/**
 * Why a job is below your level, or null when it is not: an internship, trainee, fresher or junior
 * title (unless it asks for your level of years anyway), or a job that asks at most for fewer years
 * than your level ("0-2 years" for 3+). Senior and lead titles, and jobs that say nothing, are kept.
 */
export function belowLevel(job: { title: string; url: string; description: string }, level: number): string | null {
  if (level <= 0) return null;
  const asked = yearsAsked(job.title, job.url, job.description);
  const enough = !!asked && (asked.max === null || asked.max >= level);
  const senior = SENIOR_TITLE.test(job.title);
  const word = JUNIOR_TITLE.exec(job.title)?.[0];
  if (word && !senior && !enough) return `An entry-level role ("${word}") - you have more experience`;
  if (!senior && asked && !enough) return `Asks for ${asked.min}-${asked.max} years - below your level (${level}+)`;
  return null;
}
