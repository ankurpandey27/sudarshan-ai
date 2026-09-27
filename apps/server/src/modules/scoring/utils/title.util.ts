// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

const GENERIC = new Set([
  'senior', 'sr', 'junior', 'jr', 'lead', 'principal', 'staff', 'associate', 'head', 'chief', 'intern',
  'i', 'ii', 'iii', 'iv', 'the', 'and', 'of', 'for', 'with', 'in', 'at', 'a', 'an', 'to', 'remote', 'hybrid',
  'engineer', 'developer', 'specialist', 'consultant', 'manager', 'team', 'member', 'role',
]);

// "Senior Backend Engineer (Node.js)" -> backend, node
export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/\.js\b/g, '')
      .split(/[^a-z0-9+#]+/)
      // "nodejs" and "Node.js" are the same word.
      .map((w) => (w.length > 4 && w.endsWith('js') ? w.slice(0, -2) : w))
      .filter((w) => w.length > 1 && !GENERIC.has(w)),
  );
}
