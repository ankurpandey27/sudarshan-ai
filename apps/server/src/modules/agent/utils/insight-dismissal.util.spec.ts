// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { visibleInsights } from './insight-dismissal.util';

const card = (id: string, title: string, severity: 'error' | 'warn' | 'info' = 'info', version?: string) => ({
  id,
  severity,
  title,
  detail: 'why',
  fix: 'how',
  actions: [],
  ...(version ? { version } : {}),
});

describe('visibleInsights', () => {
  it('hides a card you dismissed, and shows it again when the situation changes', () => {
    const failed28 = visibleInsights([card('failed', '28 applications failed', 'warn')], new Map())[0];
    const dismissed = new Map([['failed', failed28.version]]);
    // Same situation: stays hidden.
    expect(visibleInsights([card('failed', '28 applications failed', 'warn')], dismissed)).toEqual([]);
    // One more failed: it is back.
    expect(visibleInsights([card('failed', '29 applications failed', 'warn')], dismissed).map((i) => i.title)).toEqual(['29 applications failed']);
  });

  it('brings careful mode back for a new episode, even though it reads the same', () => {
    const dismissed = new Map([['careful-linkedin', 'careful since 2026-09-28T10:00:00.000Z']]);
    expect(visibleInsights([card('careful-linkedin', 'LinkedIn: careful mode', 'info', 'careful since 2026-09-28T10:00:00.000Z')], dismissed)).toEqual([]);
    expect(visibleInsights([card('careful-linkedin', 'LinkedIn: careful mode', 'info', 'careful since 2026-09-29T09:00:00.000Z')], dismissed)).toHaveLength(1);
  });

  it('keeps the most serious first, and other cards untouched', () => {
    const out = visibleInsights([card('a', 'tip'), card('b', 'blocked', 'error'), card('c', 'needs you', 'warn')], new Map([['x', 'y']]));
    expect(out.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });
});
