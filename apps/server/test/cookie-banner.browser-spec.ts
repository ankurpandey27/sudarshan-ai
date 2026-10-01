// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import puppeteer, { Browser, Page } from 'puppeteer-core';
import { findBrowserExecutable } from '../src/modules/browser/utils/browser-executable.util';
import { applicationDialogInPage, dismissCookieBannerInPage } from '../src/modules/form-engine/scripts/cookie-banner.script';

// Banners as company career sites show them (2026-09-30): each button records that it was pressed.
const page = (body: string) => `<!doctype html><html><body><h1>Senior Backend Engineer</h1><button id="apply">Apply</button>${body}
<script>window.__pressed = []; document.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { window.__pressed.push(b.innerText.trim()); if (b.closest('.banner')) b.closest('.banner').remove(); } }, true);</script></body></html>`;

describe('Cookie banners on company sites (real browser)', () => {
  let browser: Browser;
  let tab: Page;

  beforeAll(async () => {
    const executablePath = findBrowserExecutable();
    if (!executablePath) throw new Error('Chrome/Edge not found - browser tests need one installed');
    browser = await puppeteer.launch({ executablePath, headless: true });
  });
  afterAll(async () => {
    await browser?.close();
  });
  beforeEach(async () => {
    tab = await browser.newPage();
  });
  afterEach(async () => {
    await tab.close();
  });
  const pressed = () => tab.evaluate(() => (window as unknown as { __pressed: string[] }).__pressed);

  it('GlobalLogic: "Use necessary cookies only", not "Allow all"', async () => {
    await tab.setContent(
      page(`<div class="banner" role="dialog"><p>We value your privacy. Websites use cookies all the time.</p>
      <button>Allow all cookies</button><button>Customize</button><button>Use necessary cookies only</button></div>`),
    );
    expect(await tab.evaluate(dismissCookieBannerInPage)).toBe('Use necessary cookies only');
    expect(await pressed()).toEqual(['Use necessary cookies only']);
  });

  it('Stryker (Cookiebot, no reject button): "Allow selection" rather than "Allow all"', async () => {
    await tab.setContent(
      page(`<div class="banner"><h2>This website uses cookies</h2><p>By clicking "Accept All Cookies", you agree to the storing of cookies.</p>
      <label>Strictly necessary <input type="checkbox" checked disabled></label><label>Targeting cookies <input type="checkbox"></label>
      <button>Allow all</button><button>Allow selection</button></div>`),
    );
    expect(await tab.evaluate(dismissCookieBannerInPage)).toBe('Allow selection');
  });

  it('OneTrust by its id, and Usercentrics inside a shadow root', async () => {
    await tab.setContent(
      page(
        `<div class="banner" id="onetrust-banner-sdk">Cookies <button id="onetrust-accept-btn-handler">Accept All Cookies</button><button id="onetrust-reject-all-handler">Reject All</button></div>`,
      ),
    );
    expect(await tab.evaluate(dismissCookieBannerInPage)).toBe('Reject All');
    await tab.setContent(page('<div id="usercentrics-root"></div>'));
    await tab.evaluate(() => {
      const root = document.getElementById('usercentrics-root')!.attachShadow({ mode: 'open' });
      root.innerHTML = '<div><p>We use cookies and similar technologies.</p><button>Accept All</button><button>Deny</button></div>';
      root
        .querySelectorAll('button')
        .forEach((b) => b.addEventListener('click', () => (window as unknown as { __pressed: string[] }).__pressed.push(b.innerText)));
    });
    expect(await tab.evaluate(dismissCookieBannerInPage)).toBe('Deny');
  });

  it('never presses buttons of the application itself, and does nothing without a banner', async () => {
    await tab.setContent(
      page(`<form><label>Email <input type="email"></label><label><input type="checkbox"> I consent to the processing of my data</label>
      <button type="button">I agree</button><button type="button">Submit</button></form>`),
    );
    expect(await tab.evaluate(dismissCookieBannerInPage)).toBeNull();
    expect(await pressed()).toEqual([]);
  });

  it("never declines an application's own data-processing consent (Workday, Avature, SAP)", async () => {
    await tab.setContent(
      page(`<div role="dialog"><h2>Data privacy</h2><p>Do you consent to us processing your personal data for this application (GDPR)?</p>
      <button>Accept</button><button>Decline</button></div>`),
    );
    expect(await tab.evaluate(dismissCookieBannerInPage)).toBeNull();
    expect(await pressed()).toEqual([]);
  });

  it('tells an application dialog from a cookie banner', async () => {
    const sel = 'dialog[open], [role=dialog]';
    await tab.setContent(page(`<div role="dialog"><p>We use cookies.</p><label>Performance <input type="checkbox"></label><button>Allow all</button></div>`));
    expect(await tab.evaluate(applicationDialogInPage, sel)).toBe(false);
    await tab.setContent(page(`<div role="dialog"><h2>Apply</h2><label>Full name <input></label><input type="file"></div>`));
    expect(await tab.evaluate(applicationDialogInPage, sel)).toBe(true);
  });
});
