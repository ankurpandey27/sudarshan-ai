// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { STOP_WORDS } from '../constants/taste.constants';

/** Title words, keeping seniority ("senior", "manager", "intern") - often what decides. */
export function tasteWords(title: string): string[] {
  return [
    ...new Set(
      title
        .toLowerCase()
        // "Node.js", "Node JS" and "Node-JS" are one word: nodejs.
        .replace(/\b([a-z]+)[\s.-]?js\b/g, '$1js')
        .split(/[^a-z0-9+#]+/)
        .filter((w) => w.length > 1 && !STOP_WORDS.has(w)),
    ),
  ];
}
