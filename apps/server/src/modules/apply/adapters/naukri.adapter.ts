// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { Page } from 'puppeteer-core';
import { jitter, sleep } from '../../../common/utils/sleep.util';
import { BrowserService } from '../../browser/browser.service';
import { AnswerEngineService } from '../../form-engine/answer-engine.service';
import { FormRunnerService } from '../../form-engine/form-runner.service';
import { FieldKind } from '../../form-engine/enums/field-kind.enum';
import { FormRunOutcome, RunFormOptions } from '../../form-engine/interfaces/form-run.interface';
import { documentTextInPage } from '../../form-engine/scripts/page-helpers.script';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { Job } from '../../jobs/interfaces/job.interface';
import {
  NAUKRI_APPLIED_URL,
  NAUKRI_DRAWER,
  NAUKRI_FILE_QUESTION,
  NAUKRI_REFUSED,
  NEW_TAB_WAIT_MS,
  NAUKRI_SUCCESS,
} from '../constants/apply.constants';
import { PrepareStatus } from '../enums/prepare-status.enum';
import { looksClosed } from '../utils/closed.util';
import { ApplyAdapter, PrepareResult } from '../interfaces/apply-adapter.interface';
import { naukriDoneTypingInPage, naukriLastQuestionInPage, naukriSendInPage, naukriSendReadyInPage } from '../scripts/naukri-chat.script';
import { clickCatchingNewTab } from '../utils/new-tab.util';
import { asChoiceQuestion, boxesToTick } from '../utils/naukri-choices.util';
import { FormField } from '../../form-engine/interfaces/form-field.interface';

const MAX_QUESTIONS = 20;
/** A lone chip that only says yes - "Yes", "I agree", "Accept" - is the one way on: it is pressed. */
const AFFIRMATIVE_CHIP = /^(yes|i agree|agree|accept|i accept|i consent|ok|okay|continue|proceed)\.?$/i;
/** A chat question answered with chips, as a choice field for the answer engine. */
const CHIP_FIELD: FormField = {
  id: 'naukri-chip',
  kind: FieldKind.RADIO,
  label: '',
  name: '',
  placeholder: '',
  required: true,
  value: '',
  options: [],
  optionIds: [],
  error: '',
  maxLength: null,
  min: null,
  max: null,
  accept: null,
};
const REFUSED_DETAIL = 'Naukri is refusing applications for now ("please try again later") - it stays in the queue';

@Injectable()
export class NaukriApplyAdapter implements ApplyAdapter {
  constructor(
    private readonly browser: BrowserService,
    private readonly runner: FormRunnerService,
    private readonly answers: AnswerEngineService,
  ) {}

  matches(job: Job): boolean {
    return job.source === JobSource.NAUKRI;
  }

  async prepare(page: Page, job: Job): Promise<PrepareResult> {
    const result = (status: PrepareStatus, extra: Partial<PrepareResult> = {}): PrepareResult => ({
      status,
      scopeSelector: NAUKRI_DRAWER,
      successPattern: NAUKRI_SUCCESS,
      ...extra,
    });
    if (!(await this.browser.isLoggedIn('naukri'))) return result(PrepareStatus.LOGIN_REQUIRED);

    await page.goto(job.url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#apply-button, #already-applied, #company-site-button, button', { timeout: 15_000 }).catch(() => undefined);
    await sleep(600);
    const text = await page.evaluate(documentTextInPage);
    const snap = await this.runner.snapshot(page, null);
    if (looksClosed(text, snap)) return result(PrepareStatus.CLOSED, { detail: 'Job is no longer available' });
    const actions = snap.actions.filter((a) => !a.disabled);
    if (actions.some((a) => /^applied$/i.test(a.text)) || (await page.$('#already-applied'))) {
      return result(PrepareStatus.ALREADY_APPLIED);
    }
    const companySite = actions.find((a) => /apply on company (site|website)/i.test(a.text));
    if (companySite) {
      const tab = await clickCatchingNewTab(page, () => this.runner.click(page, companySite.id), NEW_TAB_WAIT_MS);
      const url = tab?.url() ?? page.url();
      await tab?.close().catch(() => undefined);
      return result(PrepareStatus.EXTERNAL, { externalUrl: url });
    }
    const apply = actions.find((a) => /^(apply|apply now|easy apply)$/i.test(a.text));
    if (!apply) return result(PrepareStatus.NO_APPLY_BUTTON);

    await this.runner.click(page, apply.id);
    await this.runner.settle(page);
    await sleep(1200);
    if (await this.refused(page)) return result(PrepareStatus.REFUSED, { detail: REFUSED_DETAIL });
    return result(PrepareStatus.READY);
  }

  async runForm(page: Page, prep: PrepareResult, opts: RunFormOptions): Promise<FormRunOutcome> {
    const out: FormRunOutcome = { status: 'stuck', detail: '', unresolved: [], steps: 0, fields: 0, memoryHits: 0, profileHits: 0, llmCalls: 0 };
    let lastQuestion = '';
    let repeats = 0;
    for (let step = 1; step <= MAX_QUESTIONS; step++) {
      out.steps = step;
      const chatOpen = !!(await page.$(NAUKRI_DRAWER).catch(() => null));
      // While the chat is open only Naukri's "applied" address counts - its pages mention "applied" everywhere.
      if (chatOpen ? NAUKRI_APPLIED_URL.test(page.url()) : await this.confirmed(page, prep, 0)) {
        return { ...out, status: 'applied', detail: 'Application submitted' };
      }
      if (!chatOpen) {
        // One-click applies navigate to a confirmation page; give it time to load.
        if (await this.confirmed(page, prep, 8000)) return { ...out, status: 'applied', detail: 'Application submitted' };
        if (await this.refused(page)) return { ...out, status: 'refused', detail: REFUSED_DETAIL };
        return { ...out, status: 'stuck', detail: 'Naukri did not confirm the application' };
      }

      // Wait for Naukri to finish "typing" before reading the next question.
      await page.waitForFunction(naukriDoneTypingInPage, { timeout: 8000 }, NAUKRI_DRAWER).catch(() => undefined);
      const question = await page.evaluate(naukriLastQuestionInPage, NAUKRI_DRAWER);
      if (question === lastQuestion) {
        if (++repeats >= 3) return { ...out, status: 'stuck', detail: `Naukri kept asking: "${question}"` };
      } else {
        repeats = 0;
        lastQuestion = question;
      }
      const snap = await this.runner.snapshot(page, NAUKRI_DRAWER);
      // The question lives in a chat bubble, not next to the input.
      // The chat keeps a file input around; a resume goes there only when the question asks for one.
      const wantsFile = NAUKRI_FILE_QUESTION.test(question);
      const shown = snap.fields.filter((f) => f.kind !== FieldKind.FILE || wantsFile);
      // A checkbox per choice: one multi-select question with those choices, not a yes/no per box.
      const boxes = shown.filter((f) => f.kind === FieldKind.CHECKBOX);
      const choice = boxes.length > 1 ? asChoiceQuestion(boxes, question) : null;
      const fields = [
        ...(choice ? [choice] : []),
        ...shown.filter((f) => !choice || f.kind !== FieldKind.CHECKBOX).map((f) => ({ ...f, label: question || f.label, required: true, value: '' })),
      ];
      // Answers offered as chips and no box to type in ("Please read and consent privacy Policy" with one "Yes" chip,
      // 7-Eleven 2026-10-05): a choice question - answered the usual way, and its chip clicked.
      if (fields.length === 0) {
        const chips: string[] = await page
          .evaluate((drawer: string) => {
            const groups = Array.from(document.querySelectorAll(`${drawer} .chatbot_Chips`));
            const last = groups[groups.length - 1];
            if (!last) return [];
            return Array.from(last.querySelectorAll('.chatbot_Chip'))
              .filter((c) => (c as HTMLElement).offsetWidth > 0)
              .map((c, i) => {
                c.setAttribute('data-jaa-chip', String(i));
                return ((c as HTMLElement).innerText || '').trim();
              });
          }, NAUKRI_DRAWER)
          .catch(() => []);
        if (chips.length) {
          const field = { ...CHIP_FIELD, label: question, options: chips };
          const res = chips.length === 1 && AFFIRMATIVE_CHIP.test(chips[0]) ? null : await this.answers.resolve([field], opts.ctx, { allowLlm: opts.allowLlm });
          if (res?.unresolved.length) return { ...out, status: 'needs_input', unresolved: res.unresolved, detail: `Naukri asks: "${question}"` };
          const wanted = res ? (res.instructions[0]?.value ?? '') : chips[0];
          const at = chips.findIndex((c) => c.toLowerCase() === wanted.toLowerCase());
          if (at >= 0) {
            opts.onStep(`Naukri: "${question.slice(0, 80)}" -> "${chips[at]}" (${res ? 'answered' : 'the only choice'})`);
            await page.click(`${NAUKRI_DRAWER} [data-jaa-chip="${at}"]`).catch(() => undefined);
            await jitter(1500, 2500);
            continue;
          }
        }
        if (!(await page.evaluate(naukriSendInPage, NAUKRI_DRAWER))) await sleep(1500);
        await jitter(1200, 2000);
        continue;
      }

      // Your profile and saved answers first, then the AI - never "AI only" (that ignored your answers).
      const resolved = await this.answers.resolve(fields, opts.ctx, { allowLlm: opts.allowLlm });
      out.fields += resolved.stats.fields;
      out.memoryHits += resolved.stats.memoryHits;
      out.profileHits += resolved.stats.profileHits;
      out.llmCalls += resolved.stats.llmCalls;
      if (resolved.unresolved.length) {
        return { ...out, status: 'needs_input', unresolved: resolved.unresolved, detail: `Naukri asks: "${question}"` };
      }
      // What was answered, and from where, so every answer sent can be checked in the flight log.
      const from = resolved.stats.llmCalls ? 'AI' : resolved.stats.memoryHits ? 'your saved answer' : resolved.stats.profileHits ? 'your profile' : 'default';
      // The chosen choices become ticks on their own boxes ("NO" never beside a real choice).
      const instructions = resolved.instructions.flatMap((i) =>
        choice && i.id === choice.id && i.kind === FieldKind.CHECKBOX_GROUP ? boxesToTick(i, boxes) : [i],
      );
      const given = choice
        ? instructions.map((i) => boxes.find((b) => b.id === i.id)?.label ?? i.value).join(', ')
        : instructions
            .map((i) => i.value)
            .filter(Boolean)
            .join(', ');
      opts.onStep(`Naukri: "${question.slice(0, 80)}" -> "${given.slice(0, 80)}" (${from})`);

      const typed = instructions.filter((i) => [FieldKind.TEXT, FieldKind.TEXTAREA, FieldKind.NUMBER].includes(i.kind));
      const others = instructions.filter((i) => !typed.includes(i));
      if (others.length) await this.runner.fill(page, others);
      for (const ins of typed) {
        // The chat box is a React contenteditable; it only reacts to real key events.
        await page.click(`[data-jaa-id="${ins.id}"]`).catch(() => undefined);
        await page.keyboard.type(ins.value, { delay: 30 });
      }
      await jitter(300, 700);
      // Save only lights up once Naukri has taken the answer.
      await page.waitForFunction(naukriSendReadyInPage, { timeout: 5000 }, NAUKRI_DRAWER).catch(() => undefined);
      await page.evaluate(naukriSendInPage, NAUKRI_DRAWER);
      await jitter(1500, 2500);
    }
    return { ...out, status: 'stuck', detail: 'Too many questions' };
  }

  /** Naukri showed "There was an error while processing your request, please try again later". */
  private async refused(page: Page): Promise<boolean> {
    return NAUKRI_REFUSED.test(await page.evaluate(documentTextInPage).catch(() => ''));
  }

  /** Naukri's confirmation: the "Applied to" page, its URL, or the job page's Applied state. */
  private async confirmed(page: Page, prep: PrepareResult, waitMs: number): Promise<boolean> {
    const deadline = Date.now() + waitMs;
    for (;;) {
      if (NAUKRI_APPLIED_URL.test(page.url())) return true;
      // The page may be mid-navigation; treat that as "not yet".
      const text = await page.evaluate(documentTextInPage).catch(() => '');
      if (prep.successPattern.test(text)) return true;
      if (await page.$('#already-applied').catch(() => null)) return true;
      if (Date.now() >= deadline) return false;
      await sleep(1000);
    }
  }
}
