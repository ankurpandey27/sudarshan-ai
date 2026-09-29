// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// "Today" means the user's local day, not the UTC day.

const pad = (n: number): string => String(n).padStart(2, '0');

export const localDay = (at: Date = new Date()): string => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

export const localDayStartIso = (at: Date = new Date()): string => {
  const start = new Date(at);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
};

export const localMonthStartIso = (at: Date = new Date()): string => new Date(at.getFullYear(), at.getMonth(), 1).toISOString();

/** "18:24" on this computer's clock, for a time today or soon; "later" when unknown. */
export const clockTime = (iso: string | undefined): string => {
  const at = iso ? new Date(iso) : null;
  return at && !isNaN(at.getTime()) ? `${pad(at.getHours())}:${pad(at.getMinutes())}` : 'later';
};
