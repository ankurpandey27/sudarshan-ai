// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Page, Target } from 'puppeteer-core';
import { SAME_SITE_TAB_WAIT_MS } from '../constants/apply.constants';

/**
 * Returns the tab opened by the click (target=_blank apply buttons), or null. Any tab that appears
 * after the click counts, not only one that names this page as its opener: LinkedIn's Apply opens
 * the company site in a tab that is not linked back to the job page, sometimes seconds later
 * (LVT, OPSWAT, Nubank, 2026-09-29).
 */
export async function clickCatchingNewTab(page: Page, click: () => Promise<void>, waitMs = SAME_SITE_TAB_WAIT_MS): Promise<Page | null> {
  const browser = page.browser();
  const before = new Set<Target>(browser.targets());
  const opened = browser.waitForTarget((t) => t.type() === 'page' && !before.has(t) && t !== page.target(), { timeout: waitMs }).catch(() => null);
  await click();
  const target = await opened;
  if (!target) return null;
  const tab = await target.page();
  if (!tab) return null;
  await tab.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => undefined);
  return tab;
}
