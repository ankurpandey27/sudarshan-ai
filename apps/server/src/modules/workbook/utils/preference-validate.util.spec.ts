// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import 'reflect-metadata';
import { validPreferenceRows } from './preference-validate.util';

describe('validPreferenceRows', () => {
  it('drops a row that breaks a limit, so it is only a warning and never counted as applied', () => {
    const out = validPreferenceRows([
      { key: 'LinkedIn daily limit', value: '500' },
      { key: 'Posted within days', value: '7' },
    ]);
    expect(out.rows.map((r) => r.key)).toEqual(['Posted within days']);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toMatch(/LinkedIn daily limit.*500.*not applied/);
  });
});
