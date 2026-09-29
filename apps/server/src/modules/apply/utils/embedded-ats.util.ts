// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Page } from 'puppeteer-core';
import { EMBEDDED_ATS } from '../constants/apply.constants';

/**
 * The address to open for an application that a company's career page shows inside a frame from a
 * hiring system (LVT's page embeds Ashby, 2026-09-29) - the form is in the frame, which Sudarshan
 * does not read. Null when there is none.
 */
export function embeddedApplicationUrl(page: Page): string | null {
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const url = frame.url();
    if (EMBEDDED_ATS.test(url)) return applicationPageOf(url);
  }
  return null;
}

/** The frame's address as a page of its own: without the embed flag, and on Ashby its Application tab. */
export function applicationPageOf(frameUrl: string): string {
  const u = new URL(frameUrl);
  for (const p of ['embed', 'embedded', 'iframe']) u.searchParams.delete(p);
  // Ashby: /<company>/<job id> is the overview; /<company>/<job id>/application is the form.
  if (/(^|\.)ashbyhq\.com$/.test(u.hostname) && /^\/[^/]+\/[0-9a-f-]{36}\/?$/i.test(u.pathname)) {
    u.pathname = `${u.pathname.replace(/\/$/, '')}/application`;
  }
  return u.toString();
}
