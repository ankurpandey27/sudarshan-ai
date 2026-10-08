// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export type SiteId = 'linkedin' | 'naukri' | 'instahyre' | 'indeed' | 'foundit' | 'hirist' | 'himalayas';

export interface SiteSession {
  id: SiteId;
  label: string;
  loginUrl: string;
  homeUrl: string;
  cookieDomain: string;
  /** Cookies present only when you are logged in; empty when Sudarshan AI cannot tell (the site's sign-in is then checked at the form). */
  authCookies: string[];
}

export interface BrowserStatus {
  running: boolean;
  executable: string | null;
  headless: boolean;
  /** loggedIn is null for a site whose login Sudarshan AI cannot check. */
  sessions: { id: SiteId; label: string; loggedIn: boolean | null }[];
}
