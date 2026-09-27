// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { StorageService } from '../../common/storage/storage.service';
import { TasteService } from './taste.service';

describe('TasteService', () => {
  let seq = 0;
  const make = () => {
    const storage = new StorageService(':memory:');
    const add = (title: string, status: string, decided = 1, remote = 0) => {
      const now = new Date().toISOString();
      const detail = JSON.stringify({ engine: 70, llm: null, matchedSkills: ['node.js'], missingSkills: [] });
      const { lastInsertRowid } = storage.run(
        `INSERT INTO jobs (source, external_id, url, title, status, score, score_detail, is_remote, user_decided, discovered_at, updated_at)
         VALUES ('linkedin', ?, ?, ?, ?, 72, ?, ?, ?, ?, ?)`,
        [String(++seq), `https://www.linkedin.com/jobs/view/${seq}/`, title, status, detail, remote, decided, now, now],
      );
      return Number(lastInsertRowid);
    };
    return { storage, add, taste: new TasteService(storage) };
  };

  it('keeps learning until it has enough of your decisions', () => {
    const { add, taste } = make();
    for (let i = 0; i < 6; i++) add('Backend Engineer', 'approved');
    for (let i = 0; i < 3; i++) add('Sales Manager', 'skipped');
    const s = taste.refresh();
    expect(s.status).toBe('learning');
    expect(s.needed).toBeGreaterThan(0);
    expect(taste.predict({ title: 'Backend Engineer', platform: 'linkedin', isRemote: true, easyApply: true, score: 70, detail: null })).toBeNull();
  });

  it('learns what you approve and skip, ranks new jobs that way, and says why', () => {
    const { storage, add, taste } = make();
    const liked = ['Backend Engineer', 'Senior Backend Developer', 'Node.js Backend Engineer', 'Backend Node.js Developer'];
    const disliked = ['Engineering Manager', 'Sales Manager', 'Delivery Manager', 'Sales Executive'];
    for (let i = 0; i < 16; i++) add(liked[i % liked.length], i % 3 ? 'approved' : 'applied', 1, 1);
    for (let i = 0; i < 16; i++) add(disliked[i % disliked.length], i % 2 ? 'skipped' : 'dismissed', 1, 0);
    // Jobs the agent sorted itself (not your decision) must not teach it.
    for (let i = 0; i < 10; i++) add('Sales Manager', 'approved', 0);

    const s = taste.refresh();
    expect(s.status).toBe('ready');
    expect(s.decisions).toBe(32);
    expect(s.likes).toContain('title: backend');
    expect(s.dislikes).toContain('title: manager');
    expect(s.accuracy).toBeGreaterThanOrEqual(0.8);

    const good = taste.predict({ title: 'Backend Engineer (Node.js)', platform: 'linkedin', isRemote: true, easyApply: true, score: 70, detail: null })!;
    const bad = taste.predict({ title: 'Product Manager', platform: 'linkedin', isRemote: false, easyApply: true, score: 70, detail: null })!;
    expect(good.p).toBeGreaterThan(0.7);
    expect(bad.p).toBeLessThan(0.3);
    expect(good.reasons.join()).toMatch(/\+ title: backend/);
    expect(bad.reasons.join()).toMatch(/- title: manager/);

    // Open jobs get their score stored, for sorting Review.
    const open = add('Backend Developer', 'review', 0, 1);
    taste.refresh();
    const row = storage.get<{ taste: number; taste_reasons: string }>('SELECT taste, taste_reasons FROM jobs WHERE id = ?', [open])!;
    expect(row.taste).toBeGreaterThan(0.7);
    expect(JSON.parse(row.taste_reasons).length).toBeGreaterThan(0);
  });
});
