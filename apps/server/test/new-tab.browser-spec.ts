// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { join } from 'node:path';
import puppeteer, { Browser } from 'puppeteer-core';
import { clickCatchingNewTab } from '../src/modules/apply/utils/new-tab.util';
import { findBrowserExecutable } from '../src/modules/browser/utils/browser-executable.util';

describe('Catching the tab an Apply button opens (real browser)', () => {
  let browser: Browser;

  beforeAll(async () => {
    const executablePath = findBrowserExecutable();
    if (!executablePath) throw new Error('Chrome/Edge not found - browser tests need one installed');
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--allow-file-access-from-files'] });
  });

  afterAll(async () => {
    await browser?.close();
  });

  it('catches a company site opened with no opener (LinkedIn external Apply, 2026-09-29)', async () => {
    const page = await browser.newPage();
    await page.goto(`file://${join(__dirname, 'fixtures', 'apply-new-tab.html').replace(/\\/g, '/')}`);
    const tab = await clickCatchingNewTab(page, () => page.click('#apply'));
    expect(tab).not.toBeNull();
    expect(tab!.url()).toMatch(/contact-form7-apply\.html$/);
    await tab!.close();
    await page.close();
  });

  it('catches a tab opened seconds later with no link back (window.open noopener)', async () => {
    const page = await browser.newPage();
    await page.goto(`file://${join(__dirname, 'fixtures', 'apply-late-tab.html').replace(/\\/g, '/')}`);
    const tab = await clickCatchingNewTab(page, () => page.click('#apply'), 15_000);
    expect(tab?.url()).toMatch(/contact-form7-apply\.html$/);
    await tab?.close();
    await page.close();
  });

  it('returns null when the click opens no tab', async () => {
    const page = await browser.newPage();
    await page.setContent('<button id="b">Nothing</button>');
    const started = Date.now();
    expect(await clickCatchingNewTab(page, () => page.click('#b'))).toBeNull();
    // It does not wait long for a tab that never comes.
    expect(Date.now() - started).toBeLessThan(9000);
    await page.close();
  });
});
