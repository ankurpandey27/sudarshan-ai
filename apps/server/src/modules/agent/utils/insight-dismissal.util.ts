// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Insight } from '../interfaces/insight.interface';

const RANK = { error: 0, warn: 1, info: 2 } as const;

/**
 * Cards to show, most serious first: each gets its version (its own, or its title and detail - so
 * "28 applications failed" becoming "29 ..." is new), and cards you dismissed at that version are left out.
 */
export function visibleInsights(drafts: (Omit<Insight, 'version'> & { version?: string })[], dismissed: Map<string, string>): Insight[] {
  return drafts
    .map((i) => ({ ...i, version: i.version ?? `${i.title}|${i.detail}` }))
    .filter((i) => dismissed.get(i.id) !== i.version)
    .sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
