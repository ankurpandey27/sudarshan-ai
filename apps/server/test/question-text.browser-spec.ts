// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { join } from 'node:path';
import puppeteer, { Browser } from 'puppeteer-core';
import { findBrowserExecutable } from '../src/modules/browser/utils/browser-executable.util';
import { extractFormInPage } from '../src/modules/form-engine/scripts/extract-form.script';

describe('Reading the question of a field (real browser)', () => {
  let browser: Browser;

  beforeAll(async () => {
    const executablePath = findBrowserExecutable();
    if (!executablePath) throw new Error('Chrome/Edge not found - browser tests need one installed');
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--allow-file-access-from-files'] });
  });
  afterAll(async () => {
    await browser?.close();
  });

  it('takes the text above a field - not its options, "Select an option" or the hint below (2026-09-30)', async () => {
    const page = await browser.newPage();
    await page.goto(`file://${join(__dirname, 'fixtures', 'question-text.html').replace(/\\/g, '/')}`);
    const snap = await page.evaluate(extractFormInPage, null);
    const labels = snap.fields.map((f) => f.label);
    expect(labels).toEqual([
      'Year of graduation',
      'Do you have any health concerns?',
      'How many years of Kubernetes experience do you have?',
      'Portfolio link',
      // Nothing above it: the text below is all there is.
      'Your current city',
    ]);
    await page.close();
  });
});
