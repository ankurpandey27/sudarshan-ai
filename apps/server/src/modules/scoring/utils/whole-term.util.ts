// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { escapeRegex } from '../../../common/utils/regex.util';

/** `term` appears as whole words: "Meta" matches "Meta Platforms", not "Metamorphic". */
export function containsTerm(text: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  return !!t && new RegExp(`(^|[^a-z0-9])${escapeRegex(t)}($|[^a-z0-9])`).test(text.toLowerCase());
}
