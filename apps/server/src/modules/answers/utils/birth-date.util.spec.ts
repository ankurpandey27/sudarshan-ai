// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { ageOn, parseBirthDate } from './birth-date.util';

describe('parseBirthDate', () => {
  it('reads the ways people type a date of birth in India (day first)', () => {
    for (const s of ['15/03/1995', '15-03-1995', '15.3.1995', '08-Aug-98', '15 March 1995', '1995-03-15']) {
      const d = parseBirthDate(s)!;
      expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([1998, 7, 8]);
    }
  });

  it('is not fooled by things that are not dates', () => {
    for (const s of ['yes', '31/02/1998', '13/13/1998', '1998', 'ABCDE1234F']) expect(parseBirthDate(s)).toBeNull();
  });

  it('counts whole years, before and after the birthday', () => {
    const born = new Date(1998, 7, 8);
    expect(ageOn(born, new Date(2026, 7, 7))).toBe(27);
    expect(ageOn(born, new Date(2026, 7, 8))).toBe(28);
  });
});
