// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Page } from 'puppeteer-core';
import { sleep } from '../../../common/utils/sleep.util';

const JOB_BOARD = /(^|\.)linkedin\.com$/i;

/** A job board's own address (or a blank tab) - not the company's site yet. */
export function onJobBoard(url: string): boolean {
  try {
    const u = new URL(url);
    return !/^https?:$/.test(u.protocol) || JOB_BOARD.test(u.hostname);
  } catch {
    return true;
  }
}

/**
 * The company address inside LinkedIn's "you are leaving LinkedIn" redirect
 * (linkedin.com/redir/redirect?url=..., /safety/go?url=...), or null if it is not one.
 */
export function redirectTarget(url: string): string | null {
  try {
    const u = new URL(url);
    if (!JOB_BOARD.test(u.hostname)) return null;
    const target = u.searchParams.get('url') ?? u.searchParams.get('redirect') ?? u.searchParams.get('dest');
    return target && /^https?:\/\//i.test(target) && !onJobBoard(target) ? target : null;
  } catch {
    return null;
  }
}

/**
 * Where the company's application really is, once the tab LinkedIn opened has left LinkedIn - its
 * redirect page comes first and the company site a moment later (Betasoft, 2026-09-29). Null when it
 * never leaves LinkedIn.
 */
export async function companySiteOf(tab: Page, waitMs: number): Promise<string | null> {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const url = tab.isClosed() ? '' : tab.url();
    if (url && !onJobBoard(url)) return url;
    const hidden = redirectTarget(url);
    if (hidden) return hidden;
    if (Date.now() >= deadline || tab.isClosed()) return null;
    await sleep(500);
  }
}
