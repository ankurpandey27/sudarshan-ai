// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { Page } from 'puppeteer-core';
import { sleep } from '../../../common/utils/sleep.util';
import { BrowserService } from '../../browser/browser.service';
import { FormRunnerService } from '../../form-engine/form-runner.service';
import { documentTextInPage } from '../../form-engine/scripts/page-helpers.script';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { Job } from '../../jobs/interfaces/job.interface';
import { CLOSED_TEXT, LINKEDIN_APPLIED, LINKEDIN_SCOPE, LINKEDIN_SUCCESS } from '../constants/apply.constants';
import { PrepareStatus } from '../enums/prepare-status.enum';
import { ApplyAdapter, PrepareResult } from '../interfaces/apply-adapter.interface';
import { clickCatchingNewTab } from '../utils/new-tab.util';

@Injectable()
export class LinkedInApplyAdapter implements ApplyAdapter {
  constructor(
    private readonly browser: BrowserService,
    private readonly runner: FormRunnerService,
  ) {}

  matches(job: Job): boolean {
    return job.source === JobSource.LINKEDIN;
  }

  async prepare(page: Page, job: Job): Promise<PrepareResult> {
    const result = (status: PrepareStatus, extra: Partial<PrepareResult> = {}): PrepareResult => ({
      status,
      scopeSelector: LINKEDIN_SCOPE,
      successPattern: LINKEDIN_SUCCESS,
      ...extra,
    });
    if (!(await this.browser.isLoggedIn('linkedin'))) return result(PrepareStatus.LOGIN_REQUIRED);

    await page.goto(job.url, { waitUntil: 'domcontentloaded' });
    await page
      .waitForSelector('.jobs-apply-button, .jobs-s-apply, .jobs-unified-top-card, .job-details-jobs-unified-top-card__container--two-pane', { timeout: 15_000 })
      .catch(() => undefined);
    await sleep(800);
    if (/\/(login|authwall|checkpoint|uas\/)/.test(page.url())) return result(PrepareStatus.LOGIN_REQUIRED);

    const text = await page.evaluate(documentTextInPage);
    if (CLOSED_TEXT.test(text)) return result(PrepareStatus.CLOSED, { detail: 'No longer accepting applications' });

    const snap = await this.runner.snapshot(page, null);
    const buttons = snap.actions.filter((a) => !a.disabled);
    const easy = buttons.find((a) => /easy apply/i.test(a.text));
    if (!easy) {
      if (LINKEDIN_APPLIED.test(text)) return result(PrepareStatus.ALREADY_APPLIED);
      const external = buttons.find((a) => /^apply\b/i.test(a.text));
      if (!external) return result(PrepareStatus.NO_APPLY_BUTTON);
      const tab = await clickCatchingNewTab(page, () => this.runner.click(page, external.id));
      const url = tab?.url() ?? page.url();
      await tab?.close().catch(() => undefined);
      return result(PrepareStatus.EXTERNAL, { externalUrl: url });
    }

    await this.runner.click(page, easy.id);
    // Easy Apply opens either a dialog or, in the newer flow, an /apply/ page.
    const opened = await Promise.race([
      page.waitForSelector(LINKEDIN_SCOPE, { visible: true, timeout: 12_000 }).then(() => 'dialog' as const),
      page.waitForFunction(() => /\/apply\//.test(location.pathname), { timeout: 12_000 }).then(() => 'page' as const),
    ]).catch(() => null);
    if (!opened) return result(PrepareStatus.NO_APPLY_BUTTON, { detail: 'Easy Apply did not open' });
    await this.runner.settle(page);
    return result(PrepareStatus.READY, { scopeSelector: opened === 'dialog' ? LINKEDIN_SCOPE : null });
  }

  async afterSuccess(page: Page): Promise<void> {
    await page
      .evaluate(() => {
        const done = Array.from(document.querySelectorAll('dialog[open] button, [role=dialog] button')).find((b) =>
          /^(done|dismiss|not now)$/i.test((b as HTMLElement).innerText.trim() || b.getAttribute('aria-label') || ''),
        ) as HTMLElement | undefined;
        done?.click();
      })
      .catch(() => undefined);
  }
}
