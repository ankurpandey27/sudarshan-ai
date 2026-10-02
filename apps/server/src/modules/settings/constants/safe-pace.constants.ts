// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { SourcesSettings } from '../interfaces/app-settings.interface';

/** Applications a day above which a job site starts to notice (warnings, captchas, a restricted account). */
export const SAFE_DAILY: Record<keyof SourcesSettings, number> = {
  linkedin: 30,
  naukri: 50,
  indeed: 20,
  instahyre: 40,
  links: 40,
  externalSites: 30,
};
/** Fewer seconds than this between applications is faster than a person. */
export const SAFE_MIN_GAP_SECONDS = 30;
/** More active hours a day than this means applying through the night. */
export const SAFE_ACTIVE_HOURS = 16;

export const SOURCE_SETTING_NAMES: Record<keyof SourcesSettings, string> = {
  linkedin: 'LinkedIn',
  naukri: 'Naukri',
  indeed: 'Indeed',
  instahyre: 'Instahyre',
  links: 'Other career sites',
  externalSites: 'Company career sites',
};
