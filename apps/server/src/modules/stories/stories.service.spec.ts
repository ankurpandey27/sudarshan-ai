// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { StorageService } from '../../common/storage/storage.service';
import { StoriesService } from './stories.service';
import { needsSpecifics, titleOf } from './utils/story.util';

describe('Story Bank (2026-10-01)', () => {
  let stories: StoriesService;
  beforeEach(() => {
    stories = new StoriesService(new StorageService(':memory:'));
  });

  it('asks once more when an answer has no number, date or name', () => {
    expect(needsSpecifics('we improved performance a lot')).toBe(true);
    expect(needsSpecifics('Cut API latency from 800 ms to 120 ms in two months')).toBe(false);
    expect(needsSpecifics('Rebuilt the billing service in NestJS with the payments team')).toBe(false);
  });

  it('keeps stories, names them, and finds the skills in them', () => {
    const s = stories.create('Rebuilt the order service in NestJS and Kafka. Errors fell from 2% to 0.3%.', 'proudest');
    expect(s.title).toBe('Rebuilt the order service in NestJS and Kafka');
    expect(s.skills.map((k) => k.toLowerCase())).toEqual(expect.arrayContaining(['nestjs', 'kafka']));
    expect(stories.interview().find((q) => q.id === 'proudest')?.answered).toBe(true);
    // Unanswered questions come first.
    expect(stories.interview()[0].answered).toBe(false);
  });

  it('gives each job the stories that fit it best', () => {
    stories.create('Led 3 developers through a React redesign of the dashboard in 2024.', 'led');
    stories.create('Moved reports to a Kafka queue; they finish in 4 minutes instead of 50.', 'improved');
    const lines = stories.forJob('Backend engineer: Node.js, Kafka, PostgreSQL');
    expect(lines[0]).toMatch(/Kafka queue/);
    expect(lines).toHaveLength(2);
  });

  it('edits and removes', () => {
    const s = stories.create('Something I built with Redis in 2023 for 10k users.');
    expect(stories.update(s.id, { text: 'Built a Redis cache in 2023; page loads fell to 200 ms.' }).skills.map((k) => k.toLowerCase())).toContain('redis');
    stories.remove(s.id);
    expect(stories.list()).toEqual([]);
  });

  it('titles a long first sentence briefly', () => {
    expect(titleOf('A'.repeat(20) + ' ' + 'word '.repeat(30)).length).toBeLessThanOrEqual(70);
  });
});
