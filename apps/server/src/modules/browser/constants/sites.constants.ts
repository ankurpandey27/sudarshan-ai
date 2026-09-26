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
];

// Avoid the automation banner and navigator.webdriver.
export const BROWSER_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-features=Translate,OptimizationHints,MediaRouter',
  '--password-store=basic',
  '--window-size=1366,900',
];
