// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// These tests never open a browser; puppeteer-core (ESM-only) cannot load in Jest before Node 24.9.
jest.mock('puppeteer-core', () => ({}));

import { Page } from 'puppeteer-core';
import { companySiteOf, onJobBoard, redirectTarget } from './offsite-url.util';

describe('offsite-url', () => {
  it('knows a LinkedIn page or a blank tab is not the company site', () => {
    expect(onJobBoard('https://www.linkedin.com/jobs/view/4468456656/')).toBe(true);
    expect(onJobBoard('about:blank')).toBe(true);
    expect(onJobBoard('https://www.betasoftsolutions.com/nodejs-developer/')).toBe(false);
    // Not fooled by a look-alike address.
    expect(onJobBoard('https://linkedin.com.evil.example/x')).toBe(false);
  });

  it("reads the company address out of LinkedIn's leaving-LinkedIn redirect", () => {
    const target = 'https://www.betasoftsolutions.com/nodejs-developer/';
    expect(redirectTarget(`https://www.linkedin.com/redir/redirect?url=${encodeURIComponent(target)}&urlhash=x`)).toBe(target);
    expect(redirectTarget(`https://www.linkedin.com/safety/go?url=${encodeURIComponent(target)}`)).toBe(target);
    // A redirect back into LinkedIn, or none at all, is not a company site.
    expect(redirectTarget(`https://www.linkedin.com/redir/redirect?url=${encodeURIComponent('https://www.linkedin.com/feed')}`)).toBeNull();
    expect(redirectTarget('https://www.linkedin.com/jobs/view/1/')).toBeNull();
  });

  it('waits past the redirect page for the company site (Betasoft, 2026-09-29)', async () => {
    const urls = ['about:blank', 'https://www.linkedin.com/jobs/view/1/apply/', 'https://www.betasoftsolutions.com/nodejs-developer/'];
    let i = 0;
    const tab = { isClosed: () => false, url: () => urls[Math.min(i++, urls.length - 1)] } as unknown as Page;
    expect(await companySiteOf(tab, 5000)).toBe('https://www.betasoftsolutions.com/nodejs-developer/');
  });

  it('gives up when the tab never leaves LinkedIn', async () => {
    const tab = { isClosed: () => false, url: () => 'https://www.linkedin.com/jobs/view/1/' } as unknown as Page;
    expect(await companySiteOf(tab, 600)).toBeNull();
  });
});
