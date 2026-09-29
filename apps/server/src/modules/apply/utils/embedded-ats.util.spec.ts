// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// These tests never open a browser; puppeteer-core (ESM-only) cannot load in Jest before Node 24.9.
jest.mock('puppeteer-core', () => ({}));

import { Page } from 'puppeteer-core';
import { applicationPageOf, embeddedApplicationUrl } from './embedded-ats.util';

const pageWithFrames = (...urls: string[]) => {
  const main = { url: () => 'https://www.lvt.com/careers/roles?ashby_jid=cf4d0b76-8a8c-4f5e-8261-4bf4f1831520' };
  return { mainFrame: () => main, frames: () => [main, ...urls.map((u) => ({ url: () => u }))] } as unknown as Page;
};

describe('embedded application forms', () => {
  it('opens the Ashby application a career page embeds, on its Application tab (LVT, 2026-09-29)', () => {
    const page = pageWithFrames(
      'https://www.recaptcha.net/recaptcha/api2/anchor?k=x',
      'https://jobs.ashbyhq.com/liveview-technologies/cf4d0b76-8a8c-4f5e-8261-4bf4f1831520?embed=js',
    );
    expect(embeddedApplicationUrl(page)).toBe('https://jobs.ashbyhq.com/liveview-technologies/cf4d0b76-8a8c-4f5e-8261-4bf4f1831520/application');
  });

  it('knows other hiring systems, and keeps their own address', () => {
    expect(applicationPageOf('https://job-boards.greenhouse.io/embed/job_app?for=acme&token=123')).toBe(
      'https://job-boards.greenhouse.io/embed/job_app?for=acme&token=123',
    );
    expect(embeddedApplicationUrl(pageWithFrames('https://jobs.lever.co/acme/1234/apply?iframe=true'))).toBe('https://jobs.lever.co/acme/1234/apply');
    expect(embeddedApplicationUrl(pageWithFrames('https://apply.workable.com/acme/j/ABC123/'))).toBe('https://apply.workable.com/acme/j/ABC123/');
  });

  it('ignores frames that are not an application (videos, maps, captchas, chat)', () => {
    expect(
      embeddedApplicationUrl(
        pageWithFrames(
          'https://www.youtube.com/embed/x',
          'https://www.google.com/maps/embed?pb=1',
          'https://www.recaptcha.net/recaptcha/api2/anchor',
          'about:blank',
        ),
      ),
    ).toBeNull();
    // Not fooled by a look-alike address.
    expect(embeddedApplicationUrl(pageWithFrames('https://evil.example/ashbyhq.com/job'))).toBeNull();
  });

  it('leaves an Ashby address that is already the form, or a list of jobs, as it is', () => {
    const form = 'https://jobs.ashbyhq.com/nubank/09480f02-3548-44fa-9f01-f7d90abb27c0/application';
    expect(applicationPageOf(form)).toBe(form);
    expect(applicationPageOf('https://jobs.ashbyhq.com/nubank?embed=js')).toBe('https://jobs.ashbyhq.com/nubank');
  });
});
