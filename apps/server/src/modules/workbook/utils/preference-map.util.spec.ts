// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import 'reflect-metadata';
import { AgentMode } from '../../settings/enums/agent-mode.enum';
import { mapPreferences } from './preference-map.util';
import { dropInvalid } from '../../../common/validation/drop-invalid.util';
import { UpdateSettingsDto } from '../../settings/dto/update-settings.dto';

describe('mapPreferences', () => {
  it('maps spreadsheet rows onto settings and profile', () => {
    const out = mapPreferences([
      { key: 'Keywords', value: 'Node.js Developer, Backend Engineer' },
      { key: 'Locations', value: 'Pune; Remote' },
      { key: 'Mode', value: 'Auto' },
      { key: 'LinkedIn daily limit', value: '20' },
      { key: 'Expected CTC', value: '18 LPA' },
      { key: 'Current CTC', value: '12,00,000' },
      { key: 'Willing to relocate', value: 'no' },
      { key: 'Favourite colour', value: 'blue' },
    ]);
    expect(out.settings.search?.keywords).toEqual(['Node.js Developer', 'Backend Engineer']);
    expect(out.settings.search?.locations).toEqual(['Pune', 'Remote']);
    expect(out.settings.agent?.mode).toBe(AgentMode.AUTO);
    expect(out.settings.sources?.linkedin?.dailyLimit).toBe(20);
    expect(out.profile).toMatchObject({ expectedCtc: 1_800_000, currentCtc: 1_200_000, willingToRelocate: false });
    expect(out.warnings).toEqual(['Preference "Favourite colour" = "blue" was not understood']);
  });

  it('matches row names whole, so "Exclude roles" is not taken as keywords', () => {
    const out = mapPreferences([
      { key: 'Exclude roles', value: 'Manager' },
      { key: 'Job titles', value: 'Backend Engineer' },
    ]);
    expect(out.settings.search?.keywords).toEqual(['Backend Engineer']);
    expect(out.warnings).toEqual(['Preference "Exclude roles" = "Manager" was not understood']);
  });

  it('holds imported values to the Settings limits', () => {
    const out = mapPreferences([
      { key: 'LinkedIn daily limit', value: '500' },
      { key: 'Posted within days', value: '7' },
    ]);
    const problems = dropInvalid(UpdateSettingsDto, out.settings);
    expect(problems.join()).toMatch(/dailyLimit/);
    expect(out.settings.sources?.linkedin?.dailyLimit).toBeUndefined();
    expect(out.settings.search?.postedWithinDays).toBe(7);
  });
});
