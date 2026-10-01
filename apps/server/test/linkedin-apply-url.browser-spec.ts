// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import puppeteer, { Browser } from 'puppeteer-core';
import { continueLinkedinInterstitialInPage, linkedinCompanyApplyUrlInPage } from '../src/modules/apply/scripts/linkedin-apply-url.script';
import { findBrowserExecutable } from '../src/modules/browser/utils/browser-executable.util';

describe("LinkedIn's Apply to a company site (real browser)", () => {
  let browser: Browser;

  beforeAll(async () => {
    const executablePath = findBrowserExecutable();
    if (!executablePath) throw new Error('Chrome/Edge not found - browser tests need one installed');
    browser = await puppeteer.launch({ executablePath, headless: true });
  });
  afterAll(async () => {
    await browser?.close();
  });

  it("reads the company's apply address from the job page's data, both ways LinkedIn stores it (Deloitte, 2026-09-30)", async () => {
    const page = await browser.newPage();
    await page.setContent(
      '<button>Apply</button><code style="display:none">{"companyApplyUrl":"https:\\u002F\\u002Fdeloittecm.avature.net\\u002Fen_US\\u002Fcareers\\u002FJobDetail\\u002F10969?source=LinkedIn&amp;x=1"}</code>',
    );
    expect(await page.evaluate(linkedinCompanyApplyUrlInPage)).toBe('https://deloittecm.avature.net/en_US/careers/JobDetail/10969?source=LinkedIn&x=1');
    await page.setContent('<code style="display:none">{&quot;companyApplyUrl&quot;:&quot;https://careers.btgpactual.com/job/123&quot;}</code>');
    expect(await page.evaluate(linkedinCompanyApplyUrlInPage)).toBe('https://careers.btgpactual.com/job/123');
    await page.setContent('<button>Apply</button><p>Nothing here</p>');
    expect(await page.evaluate(linkedinCompanyApplyUrlInPage)).toBeNull();
    await page.close();
  });

  it('presses "Continue" on LinkedIn\'s pop-up before the company site', async () => {
    const page = await browser.newPage();
    await page.setContent('<div role="dialog"><p>You are leaving LinkedIn</p><button onclick="window.__go=1">Continue</button><button>Cancel</button></div>');
    expect(await page.evaluate(continueLinkedinInterstitialInPage)).toBe('Continue');
    expect(await page.evaluate(() => (window as unknown as { __go: number }).__go)).toBe(1);
    await page.close();
  });
});
