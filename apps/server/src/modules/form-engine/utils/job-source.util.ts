// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { BOARD_FALLBACKS, COMPANY_SITE_FALLBACKS } from '../constants/job-source.constants';
import { matchOption } from './option-match.util';

/**
 * "How did you hear about this job?" answered with where it was really found - Indeed, LinkedIn, Naukri,
 * or the company's own website for a link you added - in the form's own words: the board by name when
 * it is listed, else the closest honest choice ("Job board", "Online"), and "Other" only as a last resort.
 * Null when a list offers nothing that fits; without a list, the source by name.
 */
export function jobSourceAnswer(foundOn: string | undefined, options: string[]): string | null {
  const source = foundOn || 'LinkedIn';
  if (!options.length) return source;
  const companySite = /company|career|website/i.test(source);
  for (const want of [source, ...(companySite ? COMPANY_SITE_FALLBACKS : BOARD_FALLBACKS)]) {
    const i = matchOption(want, options);
    if (i >= 0) return options[i];
  }
  return null;
}
