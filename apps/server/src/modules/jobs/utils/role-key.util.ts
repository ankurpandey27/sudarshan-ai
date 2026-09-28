// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/**
 * A job title reduced to its words, so the same role listed twice compares equal:
 * "Senior Developer (Node.js, React, PWA, MongoDB)" and "senior developer - node.js react pwa mongodb".
 */
export function roleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .trim();
}
