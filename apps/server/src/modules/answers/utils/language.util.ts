// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { ENGLISH_WORDS, FOREIGN_WORDS } from '../constants/language.constants';

/**
 * Whether a question is probably not in English: another script (Hindi, Arabic, Chinese...), accented
 * letters (Português, Español, Français), or more common Dutch/German/Spanish/... words than English ones.
 * A short English label ("Phone Device Type", "URL") has neither, and counts as English.
 */
export function looksNonEnglish(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Letters beyond Latin, e.g. Devanagari or Cyrillic.
  if (/[^\p{Script=Latin}\p{Script=Common}\p{M}]/u.test(t)) return true;
  if (/[À-ÖØ-öø-ɏ]/.test(t)) return true;
  // "address(es)", "year(s)": English plural endings, not the Spanish "es".
  const words =
    t
      .toLowerCase()
      .replace(/\((e?s)\)/g, '')
      .match(/[a-z]+/g) ?? [];
  const foreign = words.filter((w) => FOREIGN_WORDS.has(w)).length;
  const english = words.filter((w) => ENGLISH_WORDS.has(w)).length;
  return foreign > 0 && foreign > english;
}
