// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { localDay, localDayStartIso } from './date.util';

describe('date-utils (local time)', () => {
  it('localDay formats the LOCAL calendar day', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDay(new Date(2026, 0, 6, 0, 1))).toBe('2026-01-06');
  });

  it('localDayStartIso is the instant of the last local midnight', () => {
    expect(localDayStartIso(new Date(2026, 8, 23, 22, 15))).toBe(new Date(2026, 8, 23).toISOString());
  });
});
