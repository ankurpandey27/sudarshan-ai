// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Keywords as one "any of these" query: `Nodejs OR NestJS OR "express js"` (a phrase is quoted to stay together). */
export function anyOf(keywords: string[], or = 'OR'): string {
  return keywords
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => (/\s/.test(k) ? `"${k}"` : k))
    .join(` ${or} `);
}
