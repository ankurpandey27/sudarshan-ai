// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { NOT_A_LOGIN_COOKIE } from '../constants/login-learning.constants';

export interface CookieInfo {
  name: string;
  httpOnly?: boolean;
  /** Seconds since 1970; -1 for a cookie that ends with the browser session. */
  expires: number;
}

/**
 * The cookies a site set when you signed in: present now, not there when its login page was opened, kept by the
 * browser (persistent) and hidden from the page's scripts (httpOnly) - the way sites keep a login. Bot shields,
 * analytics and plain session ids are never counted (Foundit: MSSOAT, MSAL; Hirist: hirist_seeker_enc - 2026-10-02).
 */
export function newLoginCookies(baseline: Set<string>, now: CookieInfo[]): string[] {
  return [...new Set(now.filter((c) => !baseline.has(c.name) && c.httpOnly === true && c.expires > 0 && !NOT_A_LOGIN_COOKIE.test(c.name)).map((c) => c.name))].sort();
}
