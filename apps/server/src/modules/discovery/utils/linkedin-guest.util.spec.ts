// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { parseSearchCards } from './linkedin-guest.util';

describe('LinkedIn guest search parsing', () => {
  // Captured from the live endpoint on 2026-09-26.
  const html = readFileSync(join(__dirname, '../../../../test/fixtures/linkedin-guest-search.html'), 'utf8');

  it('reads every card with id, title, company, location and date', () => {
    const cards = parseSearchCards(html, true);
    expect(cards).toHaveLength(10);
    for (const c of cards) {
      expect(c.source).toBe(JobSource.LINKEDIN);
      expect(c.externalId).toMatch(/^\d{8,}$/);
      expect(c.url).toBe(`https://www.linkedin.com/jobs/view/${c.externalId}/`);
      expect(c.title.length).toBeGreaterThan(3);
      expect(c.company.length).toBeGreaterThan(1);
      expect(c.easyApply).toBe(true);
    }
    expect(cards[0]).toMatchObject({ externalId: '4472065469', company: 'Upstack Data', postedAt: '2026-09-25' });
  });
});
