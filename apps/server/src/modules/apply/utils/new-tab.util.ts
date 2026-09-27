// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Page } from 'puppeteer-core';

// Returns the tab opened by the click (target=_blank apply buttons), or null.
export async function clickCatchingNewTab(page: Page, click: () => Promise<void>): Promise<Page | null> {
  const opened = page
    .browser()
    .waitForTarget((t) => t.opener() === page.target() && t.type() === 'page', { timeout: 7000 })
    .catch(() => null);
  await click();
  const target = await opened;
  if (!target) return null;
  const tab = await target.page();
  if (!tab) return null;
  await tab.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => undefined);
  return tab;
}
