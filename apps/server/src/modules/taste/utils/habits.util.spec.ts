// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { TasteFeaturesInput } from '../interfaces/taste.interface';
import { habitsOf } from './habits.util';

const job = (platform: string, skills: string[]): TasteFeaturesInput => ({
  title: 'Developer',
  platform,
  isRemote: false,
  easyApply: true,
  score: 70,
  detail: { matchedSkills: skills },
});
const many = (n: number, y: 0 | 1, j: TasteFeaturesInput) => Array.from({ length: n }, () => ({ y, job: j }));

describe('habitsOf', () => {
  it('never calls something you keep 95% of the time a dislike (LinkedIn, 2026-09-28)', () => {
    // Kept 205 of 216 LinkedIn jobs and every Naukri one: the model ranked LinkedIn lower, but you like it.
    const rows = [
      ...many(205, 1, job('linkedin', ['Node.js', 'React'])),
      ...many(11, 0, job('linkedin', ['Node.js'])),
      ...many(52, 1, job('naukri', ['Node.js'])),
    ];
    const { likes, dislikes } = habitsOf(rows);
    expect(likes).toEqual(expect.arrayContaining(['skill: node.js', 'platform: linkedin', 'platform: naukri', 'skill: react']));
    expect(dislikes).toEqual([]);
  });

  it('lists only what you really turn down', () => {
    const rows = [...many(40, 1, job('linkedin', ['Node.js'])), ...many(6, 0, job('linkedin', ['PHP'])), ...many(2, 1, job('linkedin', ['PHP']))];
    expect(habitsOf(rows).dislikes).toEqual(['skill: php']);
  });

  it('leaves out rare things from "You like"', () => {
    const rows = [...many(50, 1, job('linkedin', ['Node.js'])), ...many(2, 1, job('instahyre', ['Go']))];
    expect(habitsOf(rows).likes).toEqual(['skill: node.js', 'platform: linkedin']);
  });
});
