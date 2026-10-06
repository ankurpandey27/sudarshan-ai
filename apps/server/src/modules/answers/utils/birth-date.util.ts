// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * A date of birth as people type it in India: 15/03/1995 and 15-03-1995 (day first), 15-Mar-95,
 * 15 March 1995, or 1995-03-15. Null when it is not clearly a date.
 */
export function parseBirthDate(text: string): Date | null {
  const clean = text.trim().toLowerCase();
  let day: number, month: number, year: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(clean);
  if (match) [year, month, day] = [+match[1], +match[2], +match[3]];
  else if ((match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(clean))) [day, month, year] = [+match[1], +match[2], +match[3]];
  else if ((match = /^(\d{1,2})[\s/.-]*([a-z]{3})[a-z]*[\s/.,-]*(\d{2}|\d{4})$/.exec(clean))) {
    [day, month, year] = [+match[1], MONTHS.indexOf(match[2]) + 1, +match[3]];
  } else return null;
  // Two-digit years: a birth year is in the past.
  if (year < 100) year += year > new Date().getFullYear() % 100 ? 1900 : 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 ? date : null;
}

/** Whole years old today. */
export function ageOn(birth: Date, today = new Date()): number {
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
}
