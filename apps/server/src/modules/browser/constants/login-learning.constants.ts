// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Cookies that are never a login: bot shields, load balancers, analytics, plain session ids and CSRF tokens. */
export const NOT_A_LOGIN_COOKIE =
  /^(_|ak_bmsc$|bm_|cf_|__cf|AWSALB|incap_|visid_incap|nlbi_|datadome|PHPSESSID$|JSESSIONID$|ASP\.NET_SessionId$|connect\.sid$|csrf|xsrf|XSRF|_csrf)/;

/** Settings-table keys: the cookie names before you signed in, and the login cookies learned from them. */
export const loginBaselineKey = (site: string) => `login.baseline.${site}`;
export const loginCookiesKey = (site: string) => `login.cookies.${site}`;
