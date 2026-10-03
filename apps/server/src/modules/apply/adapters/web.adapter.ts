// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'puppeteer-core';
import { sleep } from '../../../common/utils/sleep.util';
import { FormRunnerService } from '../../form-engine/form-runner.service';
import { RecipesService } from '../../form-engine/recipes.service';
import { FormAction, FormSnapshot } from '../../form-engine/interfaces/form-field.interface';
import { documentTextInPage, visiblePasswordInPage } from '../../form-engine/scripts/page-helpers.script';
import { LearnedMove } from '../../form-engine/interfaces/learned-move.interface';
import { buildNavigatePrompt, NAVIGATE_SYSTEM_PROMPT } from '../../form-engine/utils/navigate-prompt.util';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { Job } from '../../jobs/interfaces/job.interface';
import { LlmService } from '../../llm/llm.service';
import { LlmPurpose } from '../../llm/enums/llm-purpose.enum';
import {
  ALREADY_APPLIED_TEXT,
  APPLIED_BUTTON,
  GENERIC_DIALOG as DIALOG,
  GENERIC_SUCCESS,
  LOGIN_WALL,
  ONE_CLICK_SUCCESS,
  PAGE_SWAPPED,
  EMBED_WAIT_MS,
  RENDER_WAIT_MS,
  SLOW_RENDER_WAIT_MS,
  MAX_APPLY_HOPS,
} from '../constants/apply.constants';
import { PrepareStatus } from '../enums/prepare-status.enum';
import { looksClosed } from '../utils/closed.util';
import { BOT_CHECK_DETAIL, BOT_CHECK_TEXT, BOT_CHECK_WAIT_MS } from '../constants/apply.constants';
import { ApplyAdapter, PrepareResult } from '../interfaces/apply-adapter.interface';
import { clickCatchingNewTab } from '../utils/new-tab.util';
import { onJobBoard } from '../utils/offsite-url.util';
import { embeddedApplicationUrl } from '../utils/embedded-ats.util';
import { applicationDialogInPage } from '../../form-engine/scripts/cookie-banner.script';

@Injectable()
export class WebApplyAdapter implements ApplyAdapter {
  private readonly logger = new Logger(WebApplyAdapter.name);
  // Apply buttons the AI navigator chose.
  private readonly aiPicks = new WeakSet<FormAction>();

  constructor(
    private readonly runner: FormRunnerService,
    private readonly recipes: RecipesService,
    private readonly llm: LlmService,
  ) {}

  matches(job: Job): boolean {
    return job.source === JobSource.WEB;
  }

  prepare(page: Page, job: Job): Promise<PrepareResult> {
    return this.prepareUrl(page, job.applyUrl || job.url);
  }

  // Also used when LinkedIn or Naukri hands off to a company site.
  async prepareUrl(page: Page, url: string): Promise<PrepareResult> {
    // Buttons pressed on the way to the form, handed back so a confirmed application can learn them.
    const moves: LearnedMove[] = [];
    const result = (status: PrepareStatus, extra: Partial<PrepareResult> = {}): PrepareResult => ({
      moves,
      status,
      scopeSelector: null,
      successPattern: GENERIC_SUCCESS,
      ...extra,
    });
    // A site that redirects straight away swaps the page out mid-load ("detached Frame"): once more, then read what loaded.
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(async (err: Error) => {
      if (!PAGE_SWAPPED.test(err.message)) throw err;
      await sleep(1500);
      if (onJobBoard(page.url())) await page.goto(url, { waitUntil: 'domcontentloaded' });
    });
    await this.runner.settle(page);
    let current = page;
    const domain = new URL(current.url()).hostname.replace(/^www\./, '');

    let confirmedBefore = false;
    // Buttons already pressed on the way: Workday's "Apply" opens a pop-up but stays on the page behind it.
    const pressed = new Set<string>();
    // Up to 4 presses on the way (Stryker: its own Apply, Workday's Apply, "Apply Manually", then the account page)
    // and always one more look at where the last one led.
    for (let hop = 0; hop < MAX_APPLY_HOPS; hop++) {
      // A cookie banner is not the application dialog, and covers the Apply button.
      // A bot shield (Cloudflare) in front of the page: wait for it to clear by itself, else it is yours to tick.
      if (!(await this.passBotCheck(current))) return result(PrepareStatus.CAPTCHA, { page: current, detail: BOT_CHECK_DETAIL });
      await this.runner.clearCookieBanner(current);
      const { snap, text, accountWall } = await this.readWhenReady(current);
      if (looksClosed(text, snap)) return result(PrepareStatus.CLOSED);
      if (hop === 0) {
        // The site's own button says it is done, e.g. Instahyre's "Application sent!".
        if (snap.actions.some((a) => APPLIED_BUTTON.test(a.text.trim())) || ALREADY_APPLIED_TEXT.test(text)) {
          return result(PrepareStatus.ALREADY_APPLIED, { page: current });
        }
        confirmedBefore = ONE_CLICK_SUCCESS.test(text);
      } else if (snap.actions.some((a) => APPLIED_BUTTON.test(a.text.trim())) || (!confirmedBefore && ONE_CLICK_SUCCESS.test(text))) {
        // One-click apply: the confirmation appeared after our click.
        return result(PrepareStatus.APPLIED, { detail: 'Applied in one click', page: current });
      }
      // A password box means the site wants an account first (Workday's "Create Account / Sign In").
      // Sudarshan never creates accounts or types passwords: this one is yours, with the page left open.
      if (accountWall) {
        return result(PrepareStatus.LOGIN_REQUIRED, {
          // The site that asks (Workday behind a careers page), not the one the job started on.
          detail: `${hostOf(current)} needs an account before the application - sign in or create one in the agent browser, then approve the job again`,
          page: current,
        });
      }
      // A form with a captcha at the bottom is still a form: fill it, then hand the captcha over.
      if (this.hasApplicationForm(snap)) {
        // Only a dialog that holds the form counts - never a cookie banner that happens to be open.
        await this.runner.clearCookieBanner(current);
        const dialog = await current.evaluate(applicationDialogInPage, DIALOG).catch(() => false);
        return result(PrepareStatus.READY, { scopeSelector: dialog ? DIALOG : null, page: current });
      }
      // The application is in a hiring system's frame on the page (LVT embeds Ashby): open it as a page -
      // before the login check: a menu's "Sign in" and a newsletter email box are not the application (LVT).
      // The frame is often added by a script a moment after the page loads: give it a few seconds when the
      // page would otherwise be taken for a login.
      const embedded = embeddedApplicationUrl(current) ?? (this.looksLikeLogin(snap, text) ? await this.waitForEmbedded(current) : null);
      if (embedded && !pressed.has(embedded)) {
        pressed.add(embedded);
        await current.goto(embedded, { waitUntil: 'domcontentloaded' });
        await this.runner.settle(current);
        continue;
      }
      if (this.looksLikeLogin(snap, text))
        return result(PrepareStatus.LOGIN_REQUIRED, { detail: `Log in to ${hostOf(current)} in the agent browser`, page: current });

      // An "Apply now" comes first: the captcha often sits inside the application pop-up it opens
      // (Hashcash, 2026-09-28), and is handed over only after the form is filled.
      const action = await this.findApplyAction(snap, domain, text, pressed);
      if (action) moves.push({ domain, kind: 'apply', signature: null, text: action.text, by: this.aiPicks.has(action) ? 'ai' : 'rules' });
      if (action) pressed.add(action.text.trim().toLowerCase());
      if (!action) return result(snap.captcha ? PrepareStatus.CAPTCHA : PrepareStatus.NO_APPLY_BUTTON, { page: current });
      const tab = await clickCatchingNewTab(current, () => this.runner.click(current, action.id));
      if (tab) current = tab;
      await this.runner.settle(current);
      await sleep(500);
    }
    return result(PrepareStatus.NO_APPLY_BUTTON, { detail: 'Could not reach the application form', page: current });
  }

  /**
   * Reads the page once it shows something to act on. Career sites built in the browser (Workday)
   * draw their Apply button seconds after the network goes quiet, and may swap the page out while it
   * is read ("detached Frame") - so wait for a form, a login or an apply button, and read again.
   */
  /**
   * Waits while a bot-shield page ("Performing security verification", "Just a moment...") stands in front of the
   * site - in a real browser most clear in seconds. False when it is still there: one that wants a click.
   * Only a short page counts, so a job description that says "just a moment" is never mistaken for one.
   */
  private async passBotCheck(page: Page): Promise<boolean> {
    for (const until = Date.now() + BOT_CHECK_WAIT_MS; ; ) {
      const shown = await page
        .evaluate(() => ({ title: document.title, text: (document.body?.innerText ?? '').slice(0, 2000) }))
        .catch(() => ({ title: '', text: '' }));
      const check = BOT_CHECK_TEXT.test(shown.title) || (shown.text.length < 1500 && BOT_CHECK_TEXT.test(shown.text));
      if (!check) return true;
      if (Date.now() >= until) return false;
      await sleep(1500);
    }
  }

  private async readWhenReady(page: Page): Promise<{ snap: FormSnapshot; text: string; accountWall: boolean }> {
    const started = Date.now();
    for (;;) {
      try {
        const snap = await this.runner.snapshot(page, null);
        const text = await page.evaluate(documentTextInPage);
        const accountWall = await page.evaluate(visiblePasswordInPage);
        const actionable =
          accountWall ||
          this.hasApplicationForm(snap) ||
          this.looksLikeLogin(snap, text) ||
          snap.actions.some((a) => !a.disabled && (a.kind === 'apply' || APPLIED_BUTTON.test(a.text.trim())));
        // Closed-job wording does not end the wait: a footer or a "Job expired?" link is there before the Apply button.
        // Nothing to act on yet - no form, no Apply: many hiring systems draw them late (Workday's Apply comes 15-20
        // seconds after its menu and cookie banner, Stryker 2026-10-01), so such a page gets up to 30 seconds.
        const deadline = started + (snap.fields.length === 0 ? SLOW_RENDER_WAIT_MS : RENDER_WAIT_MS);
        if (actionable || Date.now() >= deadline) return { snap, text, accountWall };
      } catch (err) {
        if (!PAGE_SWAPPED.test((err as Error).message) || Date.now() >= started + SLOW_RENDER_WAIT_MS) throw err;
      }
      await sleep(1000);
    }
  }

  /** An embedded hiring-system frame that appears within EMBED_WAIT_MS, or null. */
  private async waitForEmbedded(page: Page): Promise<string | null> {
    const deadline = Date.now() + EMBED_WAIT_MS;
    while (Date.now() < deadline) {
      await sleep(1000);
      const url = embeddedApplicationUrl(page);
      if (url) return url;
    }
    return null;
  }

  private hasApplicationForm(snap: FormSnapshot): boolean {
    const labels = snap.fields.map((f) => `${f.label} ${f.name} ${f.kind}`.toLowerCase());
    // In other languages too: Naam, Name, Nom, Nombre, Nome, Imię, Namn/Navn; Telefoon, Téléphone...; Lebenslauf, Curriculum.
    const signals = [
      /name|naam|\bnom\b|nombre|\bnome\b|imi[eę]|namn|navn/,
      /e-?mail|courriel|correo/,
      /phone|mobile|telefo|téléphone|teléfono|m[oó]vil|handy|celular|cellulare/,
      /resume|cv|file|lebenslauf|curriculum/,
    ].filter((re) => labels.some((l) => re.test(l))).length;
    return snap.fields.length >= 2 && signals >= 2;
  }

  private looksLikeLogin(snap: FormSnapshot, text: string): boolean {
    const onlyAuth = snap.fields.length > 0 && snap.fields.length <= 3 && snap.fields.every((f) => /e-?mail|user|login|password/i.test(`${f.label} ${f.name}`));
    return LOGIN_WALL.test(text) || (onlyAuth && /sign in|log in|login/i.test(text));
  }

  private async findApplyAction(snap: FormSnapshot, domain: string, text: string, pressed = new Set<string>()): Promise<FormAction | null> {
    // Links in words Sudarshan does not know are candidates too: "Apply" may be in any language.
    const usable = [...snap.actions, ...(snap.links ?? [])].filter((a) => !a.disabled && !pressed.has(a.text.trim().toLowerCase()));
    const recipe = this.recipes.get(domain);
    const learned = usable.find((a) => recipe.applyTexts.includes(a.text.toLowerCase()));
    if (learned) return learned;
    // "Apply now" on a job page is often classed as a submit button (Instahyre's one-click apply).
    const obvious = usable.find((a) => a.kind === 'apply') ?? usable.find((a) => /^(easy |quick )?apply( now| for this job)?!?$/i.test(a.text.trim()));
    if (obvious) return obvious;
    if (!this.llm.isAvailable() || usable.length === 0) return null;
    try {
      const pick = await this.llm.json<{ id?: string; applicationDone?: boolean }>(buildNavigatePrompt('Open the job application form', text, usable), {
        purpose: LlmPurpose.NAVIGATE,
        system: NAVIGATE_SYSTEM_PROMPT,
        maxTokens: 150,
      });
      const action = usable.find((a) => a.id === pick.id) ?? null;
      // Learned only if the application is then confirmed (see the moves in the prepare result).
      if (action) this.aiPicks.add(action);
      return action;
    } catch (err) {
      this.logger.warn(`Navigator failed on ${domain}: ${(err as Error).message}`);
      return null;
    }
  }
}

/** The site a page is on, without "www.". */
function hostOf(page: Page): string {
  try {
    return new URL(page.url()).hostname.replace(/^www\./, '');
  } catch {
    return 'this site';
  }
}
