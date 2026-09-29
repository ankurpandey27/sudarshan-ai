// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Excel and Sheets run a cell starting with these as a formula; "-5" stays a number.
const FORMULA_START = /^([=+@\t\r]|-(?!\d))/;

/** One CSV cell: quoted when needed, and never run as a formula when opened in a spreadsheet. */
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * A CSV file: a header row, then one row per record. Starts with a byte-order mark so Excel reads
 * non-English text (Hindi, accents) correctly; lines end in CRLF as the CSV standard says.
 */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
