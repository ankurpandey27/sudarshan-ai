// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export type SiteId = 'linkedin' | 'naukri' | 'instahyre' | 'indeed';

export interface SiteSession {
  id: SiteId;
  label: string;
  loginUrl: string;
  homeUrl: string;
  cookieDomain: string;
  authCookies: string[];
}

export interface BrowserStatus {
  running: boolean;
  executable: string | null;
  headless: boolean;
  sessions: { id: SiteId; label: string; loggedIn: boolean }[];
}
