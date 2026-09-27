// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { SiteSession } from '../interfaces/site-session.interface';

// A site counts as connected when one of its auth cookies is present.
export const SITES: SiteSession[] = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    loginUrl: 'https://www.linkedin.com/login',
    homeUrl: 'https://www.linkedin.com/feed/',
    cookieDomain: 'linkedin.com',
    authCookies: ['li_at'],
  },
  {
    id: 'naukri',
    label: 'Naukri',
    loginUrl: 'https://www.naukri.com/nlogin/login',
    homeUrl: 'https://www.naukri.com/mnjuser/homepage',
    cookieDomain: 'naukri.com',
    authCookies: ['nauk_at', 'nauk_rt', 'NKWAP'],
  },
  {
    id: 'instahyre',
    label: 'Instahyre',
    loginUrl: 'https://www.instahyre.com/login/',
    homeUrl: 'https://www.instahyre.com/candidate/opportunities/',
    cookieDomain: 'instahyre.com',
    authCookies: ['sessionid'],
  },
  {
    id: 'indeed',
    label: 'Indeed',
    loginUrl: 'https://secure.indeed.com/auth?hl=en_IN&co=IN',
    homeUrl: 'https://in.indeed.com/',
    cookieDomain: 'indeed.com',
    // Set only after sign-in; a logged-out visit has none of them.
    authCookies: ['PPID', 'SHOE', 'SOCK'],
  },
];

// Avoid the automation banner and navigator.webdriver.
export const BROWSER_ARGS = [
  // Hides navigator.webdriver from sites. Chrome warns about this flag in a bar; --test-type suppresses that bar.
  '--disable-blink-features=AutomationControlled',
  '--test-type',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-features=Translate,OptimizationHints,MediaRouter',
  '--password-store=basic',
  '--window-size=1366,900',
];
