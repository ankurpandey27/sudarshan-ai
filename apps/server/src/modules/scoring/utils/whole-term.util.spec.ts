// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { containsTerm } from './whole-term.util';

describe('containsTerm', () => {
  it('matches whole company names and title words only', () => {
    expect(containsTerm('Meta Platforms', 'Meta')).toBe(true);
    expect(containsTerm('Metamorphic Labs', 'Meta')).toBe(false);
    expect(containsTerm('Infosys Limited', 'infosys')).toBe(true);
    expect(containsTerm('Senior C++ Engineer', 'C++')).toBe(true);
    expect(containsTerm('Sales Manager', 'manager')).toBe(true);
    expect(containsTerm('Management Trainee', 'manager')).toBe(false);
    expect(containsTerm('Anything', '  ')).toBe(false);
  });
});
