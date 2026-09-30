// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { join } from 'node:path';
import puppeteer, { Browser } from 'puppeteer-core';
import { indeedAppliedKeysInPage, indeedPageStateInPage } from '../src/modules/applied-sync/scripts/indeed-applied.script';
import { findBrowserExecutable } from '../src/modules/browser/utils/browser-executable.util';

describe("Reading Indeed's list of your applications (real browser)", () => {
  let browser: Browser;

  beforeAll(async () => {
    const executablePath = findBrowserExecutable();
    if (!executablePath) throw new Error('Chrome/Edge not found - browser tests need one installed');
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--allow-file-access-from-files'] });
  });

  afterAll(async () => {
    await browser?.close();
  });

  it('takes only the applied jobs - never saved or recommended ones on the same page', async () => {
    const page = await browser.newPage();
    await page.goto(`file://${join(__dirname, 'fixtures', 'indeed-myjobs-applied.html').replace(/\\/g, '/')}`);
    const { keys, cards } = await page.evaluate(indeedAppliedKeysInPage);
    expect(keys.sort()).toEqual(['0438045045a653c1', '1111222233334444', 'bd85ec3239de10d9']);
    expect(cards).toBe(3);
    expect(await page.evaluate(indeedPageStateInPage)).toBe('list');
    await page.close();
  });

  it("notices Indeed's sign-in page instead of reading nothing", async () => {
    const page = await browser.newPage();
    await page.setContent('<form action="/account/login"><input type="email"><input type="password"><button>Sign in</button></form>');
    expect(await page.evaluate(indeedPageStateInPage)).toBe('signin');
    expect((await page.evaluate(indeedAppliedKeysInPage)).keys).toEqual([]);
    await page.close();
  });

  it('is not fooled by hidden login forms or a page still loading, when you are logged in (2026-09-30)', async () => {
    const page = await browser.newPage();
    // My jobs with its list, plus a hidden login form in its header - as Indeed's pages carry.
    await page.goto(`file://${join(__dirname, 'fixtures', 'indeed-myjobs-applied.html').replace(/\\/g, '/')}`);
    await page.evaluate(() =>
      document.body.insertAdjacentHTML('afterbegin', '<form action="/account/login" style="display:none"><input type="password"></form>'),
    );
    expect(await page.evaluate(indeedPageStateInPage)).toBe('list');
    // Still drawing (nothing yet): not "signed out".
    await page.setContent('<div id="root">Loading...</div>');
    expect(await page.evaluate(indeedPageStateInPage)).toBe('loading');
    // A sign-in form really on screen.
    await page.setContent('<form><input type="email"><input type="password"><button>Sign in</button></form>');
    expect(await page.evaluate(indeedPageStateInPage)).toBe('signin');
    await page.close();
  });
});
