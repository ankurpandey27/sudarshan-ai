// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ElementHandle, Page } from 'puppeteer-core';
import { jitter, sleep } from '../../common/utils/sleep.util';
import { LlmService } from '../llm/llm.service';
import { LlmPurpose } from '../llm/enums/llm-purpose.enum';
import { AnswerEngineService } from './answer-engine.service';
import { RecipesService } from './recipes.service';
import { FieldKind } from './enums/field-kind.enum';
import { FillInstruction } from './interfaces/fill-instruction.interface';
import { FormAction, FormField, FormSnapshot } from './interfaces/form-field.interface';
import { FormRunOutcome, RunFormOptions } from './interfaces/form-run.interface';
import { LearnedMove } from './interfaces/learned-move.interface';
import { extractFormInPage } from './scripts/extract-form.script';
import { fillFieldsInPage } from './scripts/fill-fields.script';
import { documentTextInPage, pageQuietInPage, pickTypeaheadOptionInPage, visibleOptionsInPage } from './scripts/page-helpers.script';
import { CONFIRM_SYSTEM_PROMPT, NAVIGATE_SYSTEM_PROMPT, buildConfirmPrompt, buildNavigatePrompt } from './utils/navigate-prompt.util';
import {
  CAPTCHA_WAIT_MS,
  MAX_OTHER_MOVES,
  RESUME_ON_PAGE,
  NEVER_ADVANCE,
  SENT_FORM,
  CONFIRMED_WORLDWIDE,
  STEP_RENDER_WAIT_MS,
  SLOW_STEP_RENDER_WAIT_MS,
  LATE_CAPTCHA_WAIT_MS,
  MAX_SAME_FORM_SENDS,
  MAX_PROBED_COMBOBOXES,
  NAVIGATED,
  SEND_WAIT_MS,
  NO_CHANGE_WAIT_MS,
  SETTLE_MAX_MS,
  SETTLE_MIN_MS,
  SETTLE_QUIET_MS,
} from './constants/form-runner.constants';
import { needsAnswer } from './utils/field-value.util';
import { PlaybookService } from './playbook.service';
import { stepSignature } from './utils/step-signature.util';
import { ButtonLearnerService } from '../learners/button-learner.service';
import { RescueService } from './rescue.service';
import { dismissCookieBannerInPage } from './scripts/cookie-banner.script';
import { WidgetRecipesService } from './widget-recipes.service';
import { FillMethod } from './enums/fill-method.enum';
import { METHODS_BY_KIND, MAX_RECOVERED_FIELDS, TEXT_METHODS } from './constants/fill-check.constants';
import { clickChoiceNearFieldInPage, fieldHtmlInPage, widgetSignaturesInPage } from './scripts/field-widget.script';
import { heldAnswer, intendedText } from './utils/fill-check.util';
import { isSensitive, redactSensitive } from '../answers/utils/sensitive.util';

const ACTION_PRIORITY: Record<FormAction['kind'], number> = { submit: 4, review: 3, next: 2, apply: 1, dismiss: -1, other: 0 };

@Injectable()
export class FormRunnerService {
  private readonly logger = new Logger(FormRunnerService.name);
  // Buttons the AI navigator chose, so a confirmed application credits them to the AI.
  private readonly aiPicks = new WeakSet<FormAction>();

  constructor(
    private readonly answers: AnswerEngineService,
    private readonly recipes: RecipesService,
    private readonly llm: LlmService,
    private readonly playbook: PlaybookService,
    @Optional() private readonly buttonLearner?: ButtonLearnerService,
    @Optional() private readonly rescue?: RescueService,
    @Optional() private readonly widgetRecipes?: WidgetRecipesService,
  ) {}

  /**
   * The form as it is now. A page that moves on while it is being read (a Submit answered by a new page)
   * is read again once the new page is there, instead of failing the whole application.
   */
  /**
   * Fills, then reads the fields again to see the answers took. A field that did not take its answer
   * (still empty, still "Select an option", an error on it) is tried again the way that worked for this
   * kind of field before, then the other ways a person would operate it, then as the AI suggests from a
   * picture of it - and what works is learned for next time. Returns the ids of the fields that hold.
   */
  async fillAndCheck(page: Page, snap: FormSnapshot, instructions: FillInstruction[], opts: RunFormOptions, step: number): Promise<Set<string>> {
    const held = new Set<string>();
    const checkable = instructions.filter((i) => i.kind !== FieldKind.FILE);
    const signatures = await page
      .evaluate(
        widgetSignaturesInPage,
        checkable.map((i) => i.id),
      )
      .catch(() => ({}) as Record<string, string>);
    // A field whose widget has a learned way of working is done that way straight away.
    const learned = new Map<string, FillMethod>();
    for (const ins of checkable) {
      const method = this.widgetRecipes?.best(opts.domain, signatures[ins.id] ?? '');
      if (method && method !== FillMethod.NATIVE) learned.set(ins.id, method);
    }
    await this.fill(
      page,
      instructions.filter((i) => !learned.has(i.id)),
    );
    for (const [id, method] of learned) {
      const ins = instructions.find((i) => i.id === id)!;
      const field = snap.fields.find((f) => f.id === id);
      if (field) await this.operate(page, ins, field, method);
    }
    await sleep(400);
    let now = await this.snapshot(page, opts.scopeSelector).catch(() => null);
    if (!now) return new Set(instructions.map((i) => i.id));
    const failed: FillInstruction[] = [];
    for (const ins of instructions) {
      const field = now.fields.find((f) => f.id === ins.id);
      // Gone from the page (a step that moved on, a field that became something else): nothing to check.
      if (!field || heldAnswer(field, ins)) held.add(ins.id);
      else failed.push(ins);
    }
    // In the box but rejected ("Invalid input"): the answer's FORMAT is wrong, not how it was put in - operating it
    // again changes nothing. It is not saved, and the next pass re-answers it with the site's error in hand.
    const rejected = (ins: FillInstruction) => {
      const f = now!.fields.find((x) => x.id === ins.id);
      return !!f && !!f.error && f.value.trim() !== '' && ![FieldKind.SELECT, FieldKind.COMBOBOX, FieldKind.RADIO].includes(f.kind);
    };
    for (const ins of failed.filter(rejected))
      opts.onStep(
        `Step ${step}: the site rejected the answer to "${(now.fields.find((f) => f.id === ins.id)?.label ?? '').slice(0, 60)}" - answering it again in its format`,
      );
    for (const ins of failed.filter((i) => !rejected(i)).slice(0, MAX_RECOVERED_FIELDS)) {
      const before = snap.fields.find((f) => f.id === ins.id) ?? now.fields.find((f) => f.id === ins.id)!;
      const widget = signatures[ins.id] ?? '';
      const tried = new Set<FillMethod>([learned.get(ins.id) ?? FillMethod.NATIVE]);
      if (learned.has(ins.id)) this.widgetRecipes?.record(opts.domain, widget, learned.get(ins.id)!, false);
      const ladder = (METHODS_BY_KIND[before.kind] ?? TEXT_METHODS).filter((m) => !tried.has(m));
      let fixed = false;
      for (const method of ladder) {
        tried.add(method);
        await this.operate(page, ins, before, method);
        await sleep(400);
        now = (await this.snapshot(page, opts.scopeSelector).catch(() => null)) ?? now;
        const field = now.fields.find((f) => f.id === ins.id);
        fixed = !field || heldAnswer(field, ins);
        this.widgetRecipes?.record(opts.domain, widget, method, fixed);
        if (fixed) break;
      }
      // Every usual way failed: the AI looks at the field and says how to work it.
      if (!fixed && opts.allowLlm && this.llm.isAvailable()) {
        const advice = await this.askHowToFill(page, ins, before, [...tried]);
        if (advice) {
          await this.operate(page, ins, before, advice.method, advice.text);
          await sleep(400);
          now = (await this.snapshot(page, opts.scopeSelector).catch(() => null)) ?? now;
          const field = now.fields.find((f) => f.id === ins.id);
          fixed = !field || heldAnswer(field, ins);
          this.widgetRecipes?.record(opts.domain, widget, advice.method, fixed);
        }
      }
      if (fixed) {
        held.add(ins.id);
        opts.onStep(`Step ${step}: "${before.label.slice(0, 60)}" needed another way to fill - learned for next time`);
      } else {
        opts.onStep(`Step ${step}: could not fill "${before.label.slice(0, 60)}" - tried ${[...tried].join(', ')}`);
      }
    }
    return held;
  }

  /** One way of operating a field, as a person would with mouse and keys. */
  private async operate(page: Page, ins: FillInstruction, field: FormField, method: FillMethod, override?: string): Promise<void> {
    const sel = `[data-jaa-id="${ins.id}"]`;
    const text = override ?? intendedText(ins, field);
    try {
      switch (method) {
        case FillMethod.NATIVE:
          await this.fill(page, [ins]);
          return;
        case FillMethod.KEYS:
          await page.click(sel, { count: 3 });
          await page.keyboard.press('Backspace');
          await page.keyboard.type(text, { delay: 25 });
          return;
        case FillMethod.OPEN_PICK:
          await page.click(sel);
          await sleep(500);
          if (!(await page.evaluate(pickTypeaheadOptionInPage, text, true))) {
            if (!(await page.evaluate(clickChoiceNearFieldInPage, ins.id, text))) await page.keyboard.press('Escape');
          }
          return;
        case FillMethod.TYPE_PICK:
          await page.click(sel, { count: 3 });
          await page.keyboard.press('Backspace');
          await page.keyboard.type(text, { delay: 30 });
          await sleep(800);
          if (!(await page.evaluate(pickTypeaheadOptionInPage, text, true))) {
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
          }
          return;
        case FillMethod.TYPE_ENTER:
          await page.click(sel, { count: 3 });
          await page.keyboard.press('Backspace');
          await page.keyboard.type(text, { delay: 30 });
          await sleep(600);
          await page.keyboard.press('Enter');
          return;
        case FillMethod.LABEL_CLICK:
          for (const part of text.split(' | ')) await page.evaluate(clickChoiceNearFieldInPage, ins.id, part);
          return;
      }
    } catch (err) {
      this.logger.debug(`${method} on ${ins.id} failed: ${(err as Error).message}`);
    }
  }

  /** The AI, shown the field (a picture when the model takes images, and its code), says how to operate it. */
  private async askHowToFill(page: Page, ins: FillInstruction, field: FormField, tried: FillMethod[]): Promise<{ method: FillMethod; text?: string } | null> {
    try {
      const html = redactSensitive(await page.evaluate(fieldHtmlInPage, ins.id));
      const handle = await page.$(`[data-jaa-id="${ins.id}"]`);
      const box = handle ? await handle.evaluateHandle((el) => el.parentElement?.parentElement ?? el.parentElement ?? el) : null;
      const shot =
        box && this.llm.acceptsImages() !== false
          ? await (box as unknown as ElementHandle<Element>).screenshot({ type: 'jpeg', quality: 60, encoding: 'base64' }).catch(() => null)
          : null;
      const methods = Object.values(FillMethod);
      const res = await this.llm.json<{ method?: string; text?: string }>(
        `A job application field did not take its answer when filled. Say how a person would operate it.
QUESTION: ${field.label}
FIELD KIND (as read): ${field.kind}${field.options.length ? `; options seen: ${JSON.stringify(field.options.slice(0, 15))}` : ''}
ANSWER TO PUT IN: ${isSensitive(field.label, intendedText(ins, field)) ? '[hidden]' : intendedText(ins, field)}
ALREADY TRIED (did not work): ${tried.join(', ')}
ITS HTML: ${html}

Methods: native (set the value), keys (click and type), open-pick (click it open, click the option), type-pick (type to search, click the suggestion), type-enter (type, press Enter), label-click (click the choice's own words near the field).
Return JSON: {"method":"<one of: ${methods.join(', ')}>","text":"<exactly what to type or click, if different from the answer>"}`,
        { purpose: LlmPurpose.FORM_ANSWER, maxTokens: 150, ...(shot ? { images: [{ mediaType: 'image/jpeg' as const, data: String(shot) }] } : {}) },
      );
      const method = methods.find((m) => m === res?.method);
      if (!method) return null;
      const text = typeof res.text === 'string' && res.text.trim() && !isSensitive(field.label, res.text) ? res.text.trim() : undefined;
      return { method, text };
    } catch {
      return null;
    }
  }

  /**
   * The options of searchable dropdowns that show them only when opened (Greenhouse's "Select..."): each is
   * opened, read and closed. Ones that wait for typing (a city search) show none and stay as they are.
   */
  private async readComboboxOptions(page: Page, snap: FormSnapshot): Promise<void> {
    const closed = snap.fields.filter((f) => f.kind === FieldKind.COMBOBOX && f.options.length === 0 && needsAnswer(f)).slice(0, MAX_PROBED_COMBOBOXES);
    for (const f of closed) {
      try {
        await page.click(`[data-jaa-id="${f.id}"]`);
        await sleep(450);
        const options = await page.evaluate(visibleOptionsInPage);
        await page.keyboard.press('Escape');
        if (options.length) {
          f.options = options;
          f.optionIds = [];
        }
      } catch {
        // Not clickable right now: answered as before.
      }
    }
  }

  /** Closes a cookie banner that covers the page ("necessary only" or "reject" when offered), once it shows. */
  async clearCookieBanner(page: Page): Promise<string | null> {
    const pressed = await page.evaluate(dismissCookieBannerInPage).catch(() => null);
    if (pressed) await sleep(600);
    return pressed;
  }

  async snapshot(page: Page, scopeSelector: string | null): Promise<FormSnapshot> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await page.evaluate(extractFormInPage, scopeSelector);
      } catch (err) {
        if (attempt >= 3 || !NAVIGATED.test((err as Error).message)) throw err;
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => undefined);
        await sleep(800);
      }
    }
  }

  /**
   * Fills and moves the application forward the usual way - rules, your answers, learned steps; when that
   * gets stuck on a site it does not know, the rescue agent takes over from the same page.
   */
  async run(page: Page, opts: RunFormOptions): Promise<FormRunOutcome> {
    const first = await this.steps(page, opts);
    if (first.status !== 'stuck' || opts.rescue === false || !opts.allowLlm || !this.rescue?.available()) return first;
    return this.rescue.run(page, opts, this, first);
  }

  private async steps(page: Page, opts: RunFormOptions): Promise<FormRunOutcome> {
    // Buttons that moved the form on; the caller learns them only if the application is confirmed.
    const moves: LearnedMove[] = [];
    const out: FormRunOutcome = {
      moves,
      status: 'stuck',
      detail: '',
      unresolved: [],
      steps: 0,
      fields: 0,
      memoryHits: 0,
      profileHits: 0,
      llmCalls: 0,
    };
    const maxSteps = opts.maxSteps ?? 15;
    let repeats = 0;
    // Buttons that did nothing on a kind of step during this run, so another one is tried.
    const tried = new Map<string, Set<string>>();
    let otherMoves = 0;
    let force = new Set<string>();
    // The resume is uploaded at most once per application: a file input always reads empty after the page redraws.
    // ...plus once more only if the site then complains about it ("Resume is required").
    let uploads = 0;
    // Buttons pressed in this run; nothing has been sent before the first one.
    let pressed = 0;
    // Steps already given time to finish drawing.
    const waitedOn = new Set<string>();
    // The last button pressed sent the form: a page that is not a form any more may be its confirmation.
    let justSent = false;
    // The page's text just before the last press that sent the form: a confirmation that was not there then is new.
    let beforeSend = '';
    // Submits that came back to the same form: twice is a loop (Sony on Greenhouse, 2026-10-01: four rounds of the same fill).
    let sentSameForm = 0;

    for (let step = 1; step <= maxSteps; step++) {
      out.steps = step;
      const cookies = await this.clearCookieBanner(page);
      if (cookies) opts.onStep(`Step ${step}: closed the cookie banner ("${cookies}")`);
      const snap = await this.snapshot(page, opts.scopeSelector);
      await opts.onShot?.(page, `Step ${step}`);

      // A confirmation only counts after Sudarshan pressed something, and never on a page that is
      // still a form waiting to be sent (fields plus a Submit button, or an unsolved captcha) -
      // job sites mention "applied" and "application" all over their forms.
      const stillAForm = snap.captcha || (snap.fields.length > 0 && snap.actions.some((a) => a.kind === 'submit'));
      const confirmedAt = !!opts.successUrl?.test(snap.url);
      // A form that marks itself sent (WordPress Contact Form 7) stays on the page, emptied - it still counts.
      const sentForm = pressed > 0 && (await page.$(SENT_FORM).catch(() => null)) !== null;
      // "Your application has been received" appearing right after Submit counts even when the old form is still on the
      // page behind it (DataOrb, 2026-09-30: its job form stayed under the thank-you pop-up, and "Apply" was pressed again).
      const newlyConfirmed = justSent && this.confirms(opts.successPattern, snap.text) && !this.confirms(opts.successPattern, beforeSend);
      if (
        sentForm ||
        newlyConfirmed ||
        (pressed > 0 &&
          !stillAForm &&
          (confirmedAt || this.confirms(opts.successPattern, snap.text) || this.confirms(opts.successPattern, await this.docText(page))))
      ) {
        return { ...out, status: 'applied', detail: 'Application submitted' };
      }
      // A confirmation in a language or wording not known above: the AI reads it, once per send.
      if (justSent && !stillAForm && opts.allowLlm && (await this.confirmedByAi(page, snap.text))) {
        out.llmCalls++;
        return { ...out, status: 'applied', detail: 'Application submitted' };
      }
      justSent = false;
      if (opts.scopeSelector && !snap.scopeFound) {
        return { ...out, status: 'closed', detail: 'The application dialog closed unexpectedly' };
      }

      // Upload files first: many sites read the resume and fill fields themselves,
      // which would overwrite answers typed before the upload finished.
      // A step that already shows a resume (e.g. Indeed's saved one) needs no upload unless the site insists.
      const resumeShown = RESUME_ON_PAGE.test(snap.text);
      const needsUpload = (f: FormSnapshot['fields'][number]) =>
        f.kind === FieldKind.FILE && !f.value && (uploads === 0 ? f.required || !!f.error || !resumeShown : uploads === 1 && !!f.error);
      const emptyFiles = snap.fields.filter(needsUpload);
      if (emptyFiles.length) {
        uploads++;
        const up = await this.answers.resolve(emptyFiles, opts.ctx, { allowLlm: false });
        const files = up.instructions.filter((i) => i.kind === FieldKind.FILE);
        if (files.length) {
          await this.fill(page, files);
          opts.onStep(`Step ${step}: uploaded your ${opts.ctx.resumeLabel ? `"${opts.ctx.resumeLabel}" ` : ''}resume, waiting for the site to read it`);
          await page.waitForNetworkIdle({ idleTime: 800, timeout: 15_000 }).catch(() => undefined);
          await sleep(1500);
          continue;
        }
      }

      // Searchable dropdowns show their options only when opened: read them first, so an answer becomes one of them.
      await this.readComboboxOptions(page, snap);
      const fillable = snap.fields.filter((f) => f.kind !== FieldKind.FILE || needsUpload(f));
      const resolved = await this.answers.resolve(fillable, opts.ctx, { allowLlm: opts.allowLlm, force, deferMemory: true });
      out.fields += resolved.stats.fields;
      out.memoryHits += resolved.stats.memoryHits;
      out.profileHits += resolved.stats.profileHits;
      out.llmCalls += resolved.stats.llmCalls;
      if (resolved.blockers.length) return { ...out, status: 'blocked', detail: resolved.blockers.join('; ') };
      if (resolved.unresolved.length) {
        return {
          ...out,
          status: 'needs_input',
          unresolved: resolved.unresolved,
          detail: `${resolved.unresolved.length} question(s) need your answer`,
        };
      }
      if (resolved.instructions.length) {
        opts.onStep(
          `Step ${step}: filled ${resolved.instructions.length} field(s)` +
            ` (${resolved.stats.profileHits} profile, ${resolved.stats.memoryHits} memory, ${resolved.stats.llmAnswers} AI${resolved.stats.inferred ? ` (${resolved.stats.inferred} worked out from your profile)` : ''}` +
            (resolved.stats.pastAnswerHints ? `, the AI saw your answers to ${resolved.stats.pastAnswerHints} similar question(s)` : '') +
            ')',
        );
        const held = await this.fillAndCheck(page, snap, resolved.instructions, opts, step);
        // Saved as yours only what the form shows it took - a fill that failed teaches nothing.
        this.answers.rememberHeld((resolved.toRemember ?? []).filter((r) => held.has(r.fieldId)));
        await jitter(250, 600);
      }

      // Everything else is filled; the captcha is left to the person.
      if (snap.captcha) {
        if (opts.pauseBeforeSubmit) {
          return { ...out, status: 'ready_to_submit', detail: 'Filled - type the captcha and press Submit' };
        }
        // A few seconds for checks that pass by themselves (Cloudflare); a real captcha is handed over at once, the tab
        // kept open - Sudarshan carries on by itself once you have solved it - instead of sitting idle for minutes.
        opts.onStep('Captcha shown - handing it to you (solve it any time; Sudarshan finishes the application after)');
        if (!(await this.waitForCaptcha(page, opts.scopeSelector))) {
          return { ...out, status: 'captcha', detail: 'Filled - only the captcha is left; solve it and press Submit in the open tab' };
        }
      }

      const signature = stepSignature(snap);
      const triedHere = tried.get(signature) ?? new Set<string>();
      const action = await this.chooseAction(page, snap, opts, signature, triedHere);
      if (!action) {
        // Submit greyed out until something is done - usually a captcha that loads late (Indeed's review page).
        if (snap.actions.some((a) => a.disabled && (a.kind === 'submit' || a.kind === 'apply'))) {
          // Indeed's reCAPTCHA can take 10 seconds to appear; until then it is not "stuck" (which would count towards
          // "the site may have changed" and pause the platform - Indeed, 2026-09-29).
          let again = snap;
          for (const until = Date.now() + LATE_CAPTCHA_WAIT_MS; Date.now() < until && !again.captcha;) {
            await sleep(2000);
            again = await this.snapshot(page, opts.scopeSelector).catch(() => again);
          }
          if (again.captcha) return { ...out, status: 'captcha', detail: 'Filled - only the captcha is left; solve it and press Submit in the open tab' };
          // Not a captcha: say which answers the site is still waiting for, if it shows them.
          const missing = again.fields.filter((f) => f.required && needsAnswer(f)).map((f) => f.label || f.placeholder);
          return {
            ...out,
            status: 'stuck',
            detail: missing.length
              ? `Submit stays greyed out - these still need an answer: ${missing.slice(0, 3).join('; ')}`
              : 'Submit stays greyed out - finish the form',
          };
        }
        // Nothing to press yet: often the next step is still being drawn (Indeed shows its review page a few
        // seconds after the address changes). Wait for it once per step before calling it stuck.
        // Keyed by what is on the page, not just its address: "Loading..." and the drawn step share one URL.
        const shape = `${stepShape(snap)}|${snap.actions.map((a) => a.text).join('#')}|${snap.text.length}`;
        if (!waitedOn.has(shape)) {
          waitedOn.add(shape);
          if (await this.waitForStep(page, opts.scopeSelector, snap)) continue;
        }
        return { ...out, status: 'stuck', detail: `No way forward found on ${new URL(snap.url).hostname}` };
      }
      // "Apply now" at the end of a form with fields sends it too; on a bare job page it only opens the form.
      const sends = action.kind === 'submit' || (action.kind === 'apply' && snap.fields.length > 0);
      if (sends && opts.pauseBeforeSubmit) {
        return { ...out, status: 'ready_to_submit', detail: 'Filled and waiting for you to press Submit' };
      }
      opts.onStep(`Step ${step}: "${action.text}"`);
      if (sends) opts.onSend?.();
      await this.click(page, action.id);
      pressed++;
      justSent = sends;
      if (sends) beforeSend = snap.text;
      await this.settle(page);

      let after = await this.snapshot(page, opts.scopeSelector);
      // A Submit can take a while (uploads, checks, a slow server): give it time before calling it "did nothing".
      // Nothing changed yet: a Submit may take a while (uploads, checks, a slow server), and a "Next" whose answer is
      // slow gets a few seconds too - before either counts as "did nothing" and another button is tried.
      if (stepShape(after) === stepShape(snap) && after.text === snap.text) {
        after = await this.waitForChange(page, opts.scopeSelector, snap, after, sends ? SEND_WAIT_MS : NO_CHANGE_WAIT_MS);
      }
      const errored = after.fields.filter((f) => f.error);
      // Same step = same fields and address, ignoring error messages: new errors are not progress.
      const sameStep = stepShape(after) === stepShape(snap);
      const moved = !sameStep || (!errored.length && after.text !== snap.text);
      // Submit pressed and the same form is back (its errors may not be recognised as such): never a third round.
      if (sends && sameStep && !this.confirms(opts.successPattern, after.text) && ++sentSameForm >= MAX_SAME_FORM_SENDS) {
        await this.readComboboxOptions(page, after);
        const missing = after.fields.filter((f) => f.kind !== FieldKind.FILE && ((f.required && needsAnswer(f)) || !!f.error));
        if (missing.length) {
          return {
            ...out,
            status: 'needs_input',
            unresolved: missing.map((field) => ({ field, suggestion: null })),
            detail: `The site keeps asking for ${missing.length} answer(s) - ${missing
              .map((f) => f.label)
              .slice(0, 3)
              .join('; ')}`,
          };
        }
        const why = after.errors.slice(0, 3).join('; ');
        return { ...out, status: 'stuck', detail: `Submit keeps returning to the same form${why ? `: ${why}` : ''}` };
      }
      if (errored.length && sameStep) {
        repeats++;
        if (repeats >= 2) {
          const why = [...errored.map((f) => `${f.label}: ${f.error}`), ...after.errors].slice(0, 3).join('; ');
          const stuckAt: LearnedMove = { domain: opts.domain, kind: 'advance', signature, text: action.text, by: this.aiPicks.has(action) ? 'ai' : 'rules' };
          return { ...out, status: 'stuck', detail: why || 'The form did not move forward', stuckAt };
        }
        // Validation failed: re-answer only those fields, with the error as context.
        force = new Set(errored.map((f) => f.id));
      } else if (!moved) {
        // The click changed nothing: remember that, and try another way forward on this step.
        this.playbook.record(opts.domain, signature, action.text, false);
        triedHere.add(action.text.trim().toLowerCase());
        tried.set(signature, triedHere);
        if (++otherMoves > MAX_OTHER_MOVES) return { ...out, status: 'stuck', detail: 'The form did not move forward' };
        opts.onStep(`Step ${step}: "${action.text}" did nothing - trying another way`);
      } else {
        // Moved on - but only learned once the application is confirmed, never just because the page changed.
        moves.push({ domain: opts.domain, kind: 'advance', signature, text: action.text, by: this.aiPicks.has(action) ? 'ai' : 'rules' });
        repeats = 0;
        force = new Set();
      }
    }
    return { ...out, status: 'stuck', detail: `Gave up after ${maxSteps} steps` };
  }

  // Trusted CDP click; some forms ignore synthetic clicks.
  async click(page: Page, actionId: string): Promise<void> {
    const sel = `[data-jaa-act="${actionId}"]`;
    const handle = await page.$(sel);
    if (!handle) return;
    await handle.scrollIntoView().catch(() => undefined);
    await handle.click({ delay: 40 }).catch(async () => {
      await page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.click(), sel);
    });
  }

  /** After a press that sends: the page as soon as it changes, or as it is after SEND_WAIT_MS. */
  /** After a press: the page as soon as it changes, or as it is after `waitMs`. */
  private async waitForChange(page: Page, scope: string | null, before: FormSnapshot, now: FormSnapshot, waitMs: number): Promise<FormSnapshot> {
    const deadline = Date.now() + waitMs;
    let latest = now;
    while (Date.now() < deadline) {
      await sleep(1000);
      latest = await this.snapshot(page, scope).catch(() => latest);
      if (stepShape(latest) !== stepShape(before) || latest.text !== before.text) return latest;
    }
    return latest;
  }

  /**
   * After a press, until the page has had its say: the network goes quiet, or the page itself stops
   * changing for a moment - whichever comes first. Job boards (LinkedIn, Indeed) keep background
   * requests going, so waiting for network silence alone always took the full 7 seconds per step.
   */
  async settle(page: Page): Promise<void> {
    await sleep(SETTLE_MIN_MS);
    await Promise.race([
      page.waitForNetworkIdle({ idleTime: 400, timeout: SETTLE_MAX_MS }).catch(() => undefined),
      page.evaluate(pageQuietInPage, SETTLE_QUIET_MS, SETTLE_MAX_MS).catch(() => undefined),
    ]);
    await sleep(250);
  }

  async fill(page: Page, instructions: FillInstruction[]): Promise<void> {
    const results = await page.evaluate(fillFieldsInPage, instructions);
    for (const r of results.filter((x) => !x.ok)) this.logger.debug(`fill ${r.id} failed: ${r.error}`);

    for (const ins of instructions) {
      const sel = `[data-jaa-id="${ins.id}"]`;
      if (ins.kind === FieldKind.FILE) {
        const input = (await page.$(sel)) as ElementHandle<HTMLInputElement> | null;
        await input?.uploadFile(ins.value).catch((e: Error) => this.logger.warn(`upload failed: ${e.message}`));
        await sleep(800);
      } else if (ins.kind === FieldKind.COMBOBOX) {
        const input = await page.$(sel);
        if (!input) continue;
        // A dropdown drawn as a button cannot be typed into: open it and click the option.
        if (!(await input.evaluate((el) => el.tagName === 'INPUT').catch(() => true))) {
          await input.click().catch(() => undefined);
          await sleep(500);
          if (!(await page.evaluate(pickTypeaheadOptionInPage, ins.value, true).catch(() => null))) await page.keyboard.press('Escape');
          await sleep(300);
          continue;
        }
        await input.click({ count: 3 }).catch(() => undefined);
        await page.keyboard.press('Backspace');
        await input.type(ins.value, { delay: 35 });
        await sleep(900);
        const picked = await page.evaluate(pickTypeaheadOptionInPage, ins.value);
        if (!picked) {
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Enter');
        }
        await sleep(300);
      }
    }
  }

  // Learned recipe first, then submit > review > next > apply, then one AI pick (remembered per domain).
  private async chooseAction(page: Page, snap: FormSnapshot, opts: RunFormOptions, signature: string, tried: Set<string>): Promise<FormAction | null> {
    const usable = snap.actions.filter(
      (a) => !a.disabled && a.kind !== 'dismiss' && !tried.has(a.text.trim().toLowerCase()) && !NEVER_ADVANCE.test(a.text.trim()),
    );
    // What moved this kind of step forward before, on this site.
    for (const text of this.playbook.preferred(opts.domain, signature)) {
      const known = usable.find((a) => a.text.trim().toLowerCase() === text);
      if (known) return known;
    }
    const recipe = this.recipes.get(opts.domain);
    const learned = usable.find((a) => recipe.advanceTexts.includes(a.text.toLowerCase()));
    if (learned) return learned;
    const ranked = usable.filter((a) => a.kind !== 'other').sort((a, b) => ACTION_PRIORITY[b.kind] - ACTION_PRIORITY[a.kind]);
    if (ranked.length) return ranked[0];

    // Learned from every site so far: the button that moves on, in any wording or language - before asking the AI.
    const fromLearner = await this.buttonLearner?.pick(usable).catch(() => null);
    if (fromLearner) {
      // Kept like the AI's picks: learned only if the application is then confirmed.
      this.aiPicks.add(fromLearner.action);
      return fromLearner.action;
    }

    if (!opts.allowLlm || !this.llm.isAvailable() || usable.length === 0) return null;
    try {
      const pick = await this.llm.json<{ id?: string }>(buildNavigatePrompt('Submit the job application', snap.text, usable), {
        purpose: LlmPurpose.NAVIGATE,
        system: NAVIGATE_SYSTEM_PROMPT,
        maxTokens: 150,
      });
      const action = usable.find((a) => a.id === pick.id);
      // Learned only if the application is then confirmed (see the run's moves).
      if (action) this.aiPicks.add(action);
      return action ?? null;
    } catch (err) {
      this.logger.warn(`Navigator failed: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Waits for a step that showed nothing to press to finish drawing: true once it has a button that
   * moves the form on, different fields, a captcha or other text; false if nothing changed in STEP_RENDER_WAIT_MS.
   */
  private async waitForStep(page: Page, scope: string | null, before: FormSnapshot): Promise<boolean> {
    // A page that is still loading (no fields, hardly any text - Indeed's smartapply spinner) gets longer.
    const loading = before.fields.length === 0 && before.text.trim().length < 400;
    const deadline = Date.now() + (loading ? SLOW_STEP_RENDER_WAIT_MS : STEP_RENDER_WAIT_MS);
    while (Date.now() < deadline) {
      await sleep(1500);
      const now = await this.snapshot(page, scope).catch(() => null);
      if (!now) continue;
      // Anything new: a button to press, other fields, a captcha, or a changed page (a confirmation).
      if (
        now.captcha ||
        stepShape(now) !== stepShape(before) ||
        now.text !== before.text ||
        now.actions.some((a) => a.kind !== 'other' && a.kind !== 'dismiss' && !a.disabled)
      ) {
        return true;
      }
    }
    return false;
  }

  private async waitForCaptcha(page: Page, scope: string | null): Promise<boolean> {
    const deadline = Date.now() + CAPTCHA_WAIT_MS;
    await page.bringToFront().catch(() => undefined);
    while (Date.now() < deadline) {
      await sleep(3000);
      const snap = await this.snapshot(page, scope).catch(() => null);
      if (snap && !snap.captcha) return true;
    }
    return false;
  }

  /** Whether the page confirms the application was sent, read by the AI (any language). */
  /**
   * The site confirms the application: its own wording or address, a form that marks itself sent, or
   * "thank you for your application" in any major language - never on a page that is still a form.
   */
  async isConfirmed(page: Page, snap: FormSnapshot, opts: RunFormOptions): Promise<boolean> {
    if ((await page.$(SENT_FORM).catch(() => null)) !== null) return true;
    const stillAForm = snap.captcha || (snap.fields.length > 0 && snap.actions.some((a) => a.kind === 'submit'));
    if (stillAForm) return false;
    return !!opts.successUrl?.test(snap.url) || this.confirms(opts.successPattern, snap.text) || this.confirms(opts.successPattern, await this.docText(page));
  }

  async confirmedByAi(page: Page, snapText: string): Promise<boolean> {
    if (!this.llm.isAvailable()) return false;
    try {
      const text = (await this.docText(page)) || snapText;
      const r = await this.llm.json<{ confirmed?: boolean }>(buildConfirmPrompt(text), {
        purpose: LlmPurpose.NAVIGATE,
        system: CONFIRM_SYSTEM_PROMPT,
        maxTokens: 30,
      });
      return r.confirmed === true;
    } catch (err) {
      this.logger.warn(`Confirmation check failed: ${(err as Error).message}`);
      return false;
    }
  }

  /** The site's own confirmation wording, or "thank you for your application" in any major language. */
  private confirms(pattern: RegExp, text: string): boolean {
    return pattern.test(text) || CONFIRMED_WORLDWIDE.test(text);
  }

  private docText(page: Page): Promise<string> {
    return page.evaluate(documentTextInPage).catch(() => '');
  }
}

/** The step's fields and address, without error flags, to tell "moved on" from "showed errors". */
function stepShape(s: FormSnapshot): string {
  return s.fields.map((f) => f.label).join('#') + `@${s.url.split('?')[0]}`;
}
