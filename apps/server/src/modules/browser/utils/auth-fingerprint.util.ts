// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Identifies a login session by its auth cookie values, to notice when you log in again. */
export function authFingerprint(cookies: { name: string; value: string }[]): string {
  return cookies
    .map((c) => `${c.name}=${c.value}`)
    .sort()
    .join(';');
}
