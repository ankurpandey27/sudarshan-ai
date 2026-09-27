// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { dropInvalid } from '../../../common/validation/drop-invalid.util';
import { UpdateProfileDto } from '../../profile/dto/update-profile.dto';
import { UpdateSettingsDto } from '../../settings/dto/update-settings.dto';
import { mapPreferences } from './preference-map.util';

/**
 * Keeps only the spreadsheet rows that obey the Settings and Profile limits, checked one row at a
 * time, so a rejected row is reported as a warning and never also counted as applied.
 */
export function validPreferenceRows(rows: { key: string; value: string }[]): { rows: { key: string; value: string }[]; warnings: string[] } {
  const ok: { key: string; value: string }[] = [];
  const warnings: string[] = [];
  for (const row of rows) {
    const one = mapPreferences([row]);
    const problems = [...dropInvalid(UpdateSettingsDto, one.settings), ...dropInvalid(UpdateProfileDto, one.profile)];
    if (problems.length) warnings.push(`Preference "${row.key}" = "${row.value}" not applied - ${problems.join('; ')}`);
    else ok.push(row);
  }
  return { rows: ok, warnings };
}
