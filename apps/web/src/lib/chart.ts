// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** A round axis maximum just above the data: 7 -> 8, 23 -> 25, 140 -> 150. */
export function niceMax(value: number): number {
  if (value <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (step * mag >= value) return step * mag;
  }
  return 10 * mag;
}

/** "27 Sep" from YYYY-MM-DD. */
export function shortDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Change against the period before, as a signed whole percent, or null with nothing to compare. */
export function trend(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export const pct = (part: number, whole: number): string => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '-');
