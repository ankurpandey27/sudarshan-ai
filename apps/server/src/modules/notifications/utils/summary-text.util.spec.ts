// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { needsYouText, summaryText } from './summary-text.util';

describe('notification texts', () => {
  it('sums up the day in plain lines', () => {
    const t = summaryText({
      day: '2026-10-02',
      found: 40,
      applied: [
        { platform: 'LinkedIn', count: 5 },
        { platform: 'Naukri', count: 7 },
        { platform: 'Indeed', count: 0 },
      ],
      needsYou: 2,
      questions: 1,
      failed: 1,
      replies: { interview: 1, rejected: 2 },
    });
    expect(t.title).toBe('Sudarshan today: 12 applications sent');
    expect(t.body).toBe('Applied: 12 (LinkedIn 5, Naukri 7)\nNeeds you: 2 applications and 1 question\nReplies: 1 interview, 2 not selected\nCould not apply: 1\nNew jobs found: 40');
  });

  it('says so on a quiet day', () => {
    const t = summaryText({ day: '2026-10-02', found: 0, applied: [], needsYou: 0, questions: 0, failed: 0, replies: {} });
    expect(t.body).toBe('Applied: none today\nNew jobs found: 0');
  });

  it('gathers applications that need you into one message', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ label: `Job ${i + 1} @ Acme`, why: 'captcha' }));
    const t = needsYouText(items);
    expect(t.title).toBe('7 applications need you');
    expect(t.body.split('\n')).toHaveLength(7);
    expect(t.body).toContain('...and 2 more');
  });
});
