// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** What an application attempt looked like before it started. */
export interface AttemptShape {
  platform: string;
  easyApply: boolean;
  /** Where the application form lives: the company's site, or the job board. */
  host: string;
  external: boolean;
  score: number | null;
}

/** Earlier results on a site: successes and tries. */
export type HostStats = Map<string, { ok: number; n: number }>;

/**
 * An attempt as numbers: its platform, whether it is a one-page Easy Apply or a company site, how that
 * site went before (smoothed, so one try says little), and how good a fit the job is.
 */
export function outcomeFeatures(a: AttemptShape, hosts: HostStats): Record<string, number> {
  const h = hosts.get(a.host);
  const tries = h?.n ?? 0;
  return {
    [`platform: ${a.platform}`]: 1,
    'easy apply': a.easyApply ? 1 : 0,
    'company site': a.external ? 1 : 0,
    // Two imaginary tries, one good: an unknown site starts at even odds.
    'site success rate': ((h?.ok ?? 0) + 1) / (tries + 2),
    'site known': Math.min(1, Math.log2(1 + tries) / 4),
    fit: (a.score ?? 50) / 100,
  };
}
