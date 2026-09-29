// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { join } from 'node:path';
import puppeteer, { Browser } from 'puppeteer-core';
import { indeedAppliedKeysInPage, indeedSignInShownInPage } from '../src/modules/applied-sync/scripts/indeed-applied.script';
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
    expect(await page.evaluate(indeedSignInShownInPage)).toBe(false);
    await page.close();
  });

  it("notices Indeed's sign-in page instead of reading nothing", async () => {
    const page = await browser.newPage();
    await page.setContent('<form action="/account/login"><input type="email"><input type="password"><button>Sign in</button></form>');
    expect(await page.evaluate(indeedSignInShownInPage)).toBe(true);
    expect((await page.evaluate(indeedAppliedKeysInPage)).keys).toEqual([]);
    await page.close();
  });
});
