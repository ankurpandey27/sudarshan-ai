// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { STOP_WORDS } from '../constants/taste.constants';
import { TasteFeaturesInput } from '../interfaces/taste.interface';

/** Title words, keeping seniority ("senior", "manager", "intern") - often what decides. */
export function tasteWords(title: string): string[] {
  return [
    ...new Set(
      title
        .toLowerCase()
        .replace(/\.js\b/g, 'js')
        .split(/[^a-z0-9+#]+/)
        .filter((w) => w.length > 1 && !STOP_WORDS.has(w)),
    ),
  ];
}

/** What the model looks at, as named numbers between 0 and 1. */
export function tasteFeatures(j: TasteFeaturesInput, vocabulary?: Set<string>): Record<string, number> {
  const d = j.detail ?? {};
  const matched = d.matchedSkills?.length ?? 0;
  const missing = d.missingSkills?.length ?? 0;
  const f: Record<string, number> = {
    'skills match': matched + missing ? matched / (matched + missing) : 0.5,
    'overall fit': (d.llm ?? d.engine ?? j.score ?? 50) / 100,
    'salary fit': (d.salary ?? 50) / 100,
    'location fit': (d.location ?? 50) / 100,
    remote: j.isRemote ? 1 : 0,
    'easy apply': j.easyApply ? 1 : 0,
    [`platform: ${j.platform}`]: 1,
  };
  for (const w of tasteWords(j.title)) if (!vocabulary || vocabulary.has(w)) f[`title: ${w}`] = 1;
  return f;
}
