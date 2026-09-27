// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { localDay } from '../../../common/utils/date.util';

/** The last `days` local dates, oldest first, ending today. */
export function daySeries(days: number, today: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    out.push(localDay(d));
  }
  return out;
}

/** Start of the local day `daysAgo` days before today, as an ISO timestamp. */
export function dayStartIso(daysAgo: number, today: Date = new Date()): string {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo).toISOString();
}

/** Keeps real skills and drops sentences such as "1-3 years of Java experience". */
export function isSkillName(s: string, maxLength: number): boolean {
  return s.length > 1 && s.length <= maxLength && !/\d/.test(s) && s.split(/\s+/).length <= 3;
}
