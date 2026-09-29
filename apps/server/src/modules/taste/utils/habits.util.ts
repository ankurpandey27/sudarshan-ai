// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { HABITS_SHOWN, LIKE_MIN_KEEP, LIKE_MIN_SHARE, SKIP_MIN_DECISIONS, SKIP_MIN_RATE } from '../constants/taste.constants';
import { TasteFeaturesInput } from '../interfaces/taste.interface';
import { tasteWords } from './taste-features.util';

/** What a job is made of, for counting: its matched skills, its platform, whether it is remote, and its title words. */
function traits(job: TasteFeaturesInput): string[] {
  const skills = (job.detail?.matchedSkills ?? []).map((s) => `skill: ${s.toLowerCase()}`);
  const words = tasteWords(job.title).map((w) => `title: ${w}`);
  return [...new Set([...skills, `platform: ${job.platform}`, ...(job.isRemote ? ['remote'] : []), ...words])];
}

/**
 * Your habits, counted from your decisions rather than read off the model's weights: "You like" is
 * what the jobs you kept have in common (and you kept nearly every job that had it); "You skip" is
 * only what you really turned down. A weight just below your favourite is not a dislike.
 */
export function habitsOf(rows: { y: 0 | 1; job: TasteFeaturesInput }[]): { likes: string[]; dislikes: string[] } {
  const kept = rows.filter((r) => r.y === 1).length;
  const tally = new Map<string, { kept: number; skipped: number }>();
  for (const r of rows) {
    for (const t of traits(r.job)) {
      const c = tally.get(t) ?? { kept: 0, skipped: 0 };
      if (r.y === 1) c.kept++;
      else c.skipped++;
      tally.set(t, c);
    }
  }
  const all = [...tally];
  const likes = all
    // Likes are the skills, platforms and remote work you keep coming back to - not generic title words.
    .filter(([t]) => !t.startsWith('title: '))
    .filter(([, c]) => c.kept >= kept * LIKE_MIN_SHARE && c.kept / (c.kept + c.skipped) >= LIKE_MIN_KEEP)
    .sort((a, b) => b[1].kept - a[1].kept)
    .slice(0, HABITS_SHOWN)
    .map(([t]) => t);
  // Skips may be title words too: turning down every "Manager" role is a habit worth showing.
  const dislikes = all
    .filter(([, c]) => c.kept + c.skipped >= SKIP_MIN_DECISIONS && c.skipped / (c.kept + c.skipped) >= SKIP_MIN_RATE)
    .sort((a, b) => b[1].skipped - a[1].skipped)
    .slice(0, HABITS_SHOWN)
    .map(([t]) => t);
  return { likes, dislikes };
}
