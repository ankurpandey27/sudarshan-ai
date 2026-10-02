// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { ElementHandle, Page } from 'puppeteer-core';
import { sleep } from '../../../common/utils/sleep.util';
import { FormRunnerService } from '../../form-engine/form-runner.service';
import { documentTextInPage } from '../../form-engine/scripts/page-helpers.script';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { Job } from '../../jobs/interfaces/job.interface';
import {
  APPLIED_BUTTON,
  INDEED_SUCCESS,
  INDEED_SUCCESS_URL,
  INDEED_APPLY_HOST,
  INDEED_CLOSED,
  INDEED_CHALLENGE,
  INDEED_LOGIN_URL,
  SIGN_IN_PAGE,
  NEW_TAB_WAIT_MS,
} from '../constants/apply.constants';
import { PrepareStatus } from '../enums/prepare-status.enum';
import { looksClosed } from '../utils/closed.util';
import { ApplyAdapter, PrepareResult } from '../interfaces/apply-adapter.interface';
import { clickCatchingNewTab } from '../utils/new-tab.util';

/**
 * Indeed: "Apply now" opens Indeed Apply (smartapply.indeed.com), a multi-step
 * form the generic runner fills; "Apply on company site" hands off to the
 * employer's own site, like LinkedIn and Naukri do.
 */
@Injectable()
export class IndeedApplyAdapter implements ApplyAdapter {
  constructor(private readonly runner: FormRunnerService) {}

  matches(job: Job): boolean {
    return job.source === JobSource.INDEED;
  }

  async prepare(page: Page, job: Job): Promise<PrepareResult> {
    const result = (status: PrepareStatus, extra: Partial<PrepareResult> = {}): PrepareResult => ({
      status,
      scopeSelector: null,
      successPattern: INDEED_SUCCESS,
      successUrl: INDEED_SUCCESS_URL,
      ...extra,
    });
    // Indeed only finishes drawing a job in a visible tab; a background tab stays blank under the header.
    await page.bringToFront().catch(() => undefined);
    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // Includes time for Indeed's security check ("Just a moment...") to clear by itself.
    if (!(await this.applyControlShown(page, 30_000))) {
      await page.bringToFront().catch(() => undefined);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => undefined);
      await this.applyControlShown(page, 25_000);
    }
    await sleep(800);
    const title = await page.title().catch(() => '');
    if (INDEED_CHALLENGE.test(title)) {
      return result(PrepareStatus.CAPTCHA, { detail: 'Indeed is showing a security check - finish it in the agent browser window', page });
    }
    if (INDEED_LOGIN_URL.test(page.url())) return result(PrepareStatus.LOGIN_REQUIRED, { detail: 'Log in to Indeed in the agent browser' });

    const text = await page.evaluate(documentTextInPage);
    const snap = await this.runner.snapshot(page, null);
    if (looksClosed(text, snap, INDEED_CLOSED)) return result(PrepareStatus.CLOSED, { detail: 'This job has expired on Indeed' });
    if (snap.actions.some((a) => APPLIED_BUTTON.test(a.text.trim()))) return result(PrepareStatus.ALREADY_APPLIED);

    const companySite = snap.actions.find((a) => !a.disabled && /apply on company site/i.test(a.text));
    if (companySite) {
      const tab = await clickCatchingNewTab(page, () => this.runner.click(page, companySite.id), NEW_TAB_WAIT_MS);
      // The link goes through Indeed's redirect first; wait for where it really lands.
      const target = tab ?? page;
      await target.waitForFunction(() => !/indeed\.com\/(rc\/clk|pagead|applystart)/i.test(location.href), { timeout: 15_000 }).catch(() => undefined);
      const url = target.url();
      await tab?.close().catch(() => undefined);
      // Logged out, Indeed sends this link to a sign-in page instead of the employer.
      if (SIGN_IN_PAGE.test(url))
        return result(PrepareStatus.LOGIN_REQUIRED, { detail: 'Log in to Indeed in the agent browser to follow its company-site links' });
      // Still on Indeed: the link did not reach the employer (logged out it shows a sign-in prompt instead).
      if (/(^|\.)indeed\.com$/i.test(new URL(url).hostname)) {
        const signIn = await page.evaluate(() => /sign in|log in|create an account|continue with google/i.test(document.body.innerText)).catch(() => false);
        return signIn
          ? result(PrepareStatus.LOGIN_REQUIRED, { detail: 'Log in to Indeed in the agent browser to follow its company-site links' })
          : result(PrepareStatus.NO_APPLY_BUTTON, { detail: 'Indeed did not open the company site - apply by hand' });
      }
      return result(PrepareStatus.EXTERNAL, { externalUrl: url });
    }

    // "Apply now" is a link to Indeed Apply: open it in this tab.
    const href = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a[href]')].find((x) => /smartapply\.indeed\.com/i.test((x as HTMLAnchorElement).href));
      return (a as HTMLAnchorElement | undefined)?.href ?? null;
    });
    if (!href) {
      // Logged in, "Apply now" is a button that opens Indeed Apply by script.
      const apply = await page.evaluateHandle(() => {
        const visible = (el: Element) => (el as HTMLElement).offsetWidth > 0 && !(el as HTMLButtonElement).disabled;
        const byId = document.querySelector('#indeedApplyButton, [data-testid*="indeedApply"], [data-testid*="apply-button"]');
        if (byId && visible(byId)) return byId;
        return (
          [...document.querySelectorAll('button, a, [role=button]')].find(
            (b) => visible(b) && /^(apply now|easily apply)\b/i.test(((b as HTMLElement).innerText || b.getAttribute('aria-label') || '').trim()),
          ) ?? null
        );
      });
      const el = apply.asElement() as ElementHandle<Element> | null;
      if (!el) {
        const blank = await page
          .evaluate(() => (document.querySelector('main, #viewJobSSRRoot, body')?.textContent ?? '').trim().length < 400)
          .catch(() => false);
        return result(PrepareStatus.NO_APPLY_BUTTON, {
          detail: blank
            ? 'The Indeed job page did not finish loading - try again, or apply by hand'
            : `No apply button on the Indeed page (${await page.title().catch(() => '')} - ${page.url()})`,
          page,
        });
      }
      const tab = await clickCatchingNewTab(page, () => el.click());
      if (tab) await page.goto(tab.url(), { waitUntil: 'domcontentloaded' }).finally(() => tab.close().catch(() => undefined));
      else await page.waitForFunction(() => /smartapply\.indeed\.com/.test(location.href), { timeout: 20_000 }).catch(() => undefined);
    } else {
      await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    }
    await this.runner.settle(page);
    await sleep(1500);

    if (INDEED_LOGIN_URL.test(page.url())) return result(PrepareStatus.LOGIN_REQUIRED, { detail: 'Log in to Indeed in the agent browser', page });
    if (!INDEED_APPLY_HOST.test(page.url())) return result(PrepareStatus.NO_APPLY_BUTTON, { detail: `Indeed Apply did not open (at ${page.url()})`, page });
    return result(PrepareStatus.READY, { page });
  }

  /** Waits for Indeed's apply control (or an "applied" state) to appear on the job page. */
  private applyControlShown(page: Page, timeout: number): Promise<boolean> {
    return page
      .waitForFunction(
        () =>
          !!document.querySelector('#indeedApplyButton') ||
          [...document.querySelectorAll('button, a, [role=button]')].some(
            (b) =>
              (b as HTMLElement).offsetWidth > 0 &&
              /^(apply now|apply on company site|easily apply|applied|application submitted)/i.test(
                ((b as HTMLElement).innerText || b.getAttribute('aria-label') || '').trim(),
              ),
          ),
        { timeout },
      )
      .then(() => true)
      .catch(() => false);
  }
}
