// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger } from '@nestjs/common';
import { ElementHandle, Page } from 'puppeteer-core';
import { jitter, sleep } from '../../common/utils/sleep.util';
import { LlmService } from '../llm/llm.service';
import { LlmPurpose } from '../llm/enums/llm-purpose.enum';
import { AnswerEngineService } from './answer-engine.service';
import { RecipesService } from './recipes.service';
import { FieldKind } from './enums/field-kind.enum';
import { FillInstruction } from './interfaces/fill-instruction.interface';
import { FormAction, FormSnapshot } from './interfaces/form-field.interface';
import { FormRunOutcome, RunFormOptions } from './interfaces/form-run.interface';
import { LearnedMove } from './interfaces/learned-move.interface';
import { extractFormInPage } from './scripts/extract-form.script';
import { fillFieldsInPage } from './scripts/fill-fields.script';
import { documentTextInPage, pickTypeaheadOptionInPage } from './scripts/page-helpers.script';
import { NAVIGATE_SYSTEM_PROMPT, buildNavigatePrompt } from './utils/navigate-prompt.util';
import { CAPTCHA_WAIT_MS, MAX_OTHER_MOVES, RESUME_ON_PAGE, NEVER_ADVANCE } from './constants/form-runner.constants';
import { needsAnswer } from './utils/field-value.util';
import { PlaybookService } from './playbook.service';
import { stepSignature } from './utils/step-signature.util';

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
  ) {}

  snapshot(page: Page, scopeSelector: string | null): Promise<FormSnapshot> {
    return page.evaluate(extractFormInPage, scopeSelector);
  }

  async run(page: Page, opts: RunFormOptions): Promise<FormRunOutcome> {
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

    for (let step = 1; step <= maxSteps; step++) {
      out.steps = step;
      const snap = await this.snapshot(page, opts.scopeSelector);

      // A confirmation only counts after Sudarshan pressed something, and never on a page that is
      // still a form waiting to be sent (fields plus a Submit button, or an unsolved captcha) -
      // job sites mention "applied" and "application" all over their forms.
      const stillAForm = snap.captcha || (snap.fields.length > 0 && snap.actions.some((a) => a.kind === 'submit'));
      if (pressed > 0 && !stillAForm && (opts.successPattern.test(snap.text) || opts.successPattern.test(await this.docText(page)))) {
        return { ...out, status: 'applied', detail: 'Application submitted' };
      }
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
          opts.onStep(`Step ${step}: uploaded your resume, waiting for the site to read it`);
          await page.waitForNetworkIdle({ idleTime: 800, timeout: 15_000 }).catch(() => undefined);
          await sleep(1500);
          continue;
        }
      }

      const fillable = snap.fields.filter((f) => f.kind !== FieldKind.FILE || needsUpload(f));
      const resolved = await this.answers.resolve(fillable, opts.ctx, { allowLlm: opts.allowLlm, force });
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
            ` (${resolved.stats.profileHits} profile, ${resolved.stats.memoryHits} memory, ${resolved.stats.llmAnswers} AI)`,
        );
        await this.fill(page, resolved.instructions);
        await jitter(250, 600);
      }

      // Everything else is filled; the captcha is left to the person.
      if (snap.captcha) {
        if (opts.pauseBeforeSubmit) {
          return { ...out, status: 'ready_to_submit', detail: 'Filled - type the captcha and press Submit' };
        }
        opts.onStep('Captcha shown - solve it in the agent browser window, I will wait 3 minutes');
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
          await sleep(3000);
          const again = await this.snapshot(page, opts.scopeSelector).catch(() => snap);
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
        return { ...out, status: 'stuck', detail: `No way forward found on ${new URL(snap.url).hostname}` };
      }
      // "Apply now" at the end of a form with fields sends it too; on a bare job page it only opens the form.
      const sends = action.kind === 'submit' || (action.kind === 'apply' && snap.fields.length > 0);
      if (sends && opts.pauseBeforeSubmit) {
        return { ...out, status: 'ready_to_submit', detail: 'Filled and waiting for you to press Submit' };
      }
      opts.onStep(`Step ${step}: "${action.text}"`);
      await this.click(page, action.id);
      pressed++;
      await this.settle(page);

      const after = await this.snapshot(page, opts.scopeSelector);
      const errored = after.fields.filter((f) => f.error);
      // Same step = same fields and address, ignoring error messages: new errors are not progress.
      const sameStep = stepShape(after) === stepShape(snap);
      const moved = !sameStep || (!errored.length && after.text !== snap.text);
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

  async settle(page: Page): Promise<void> {
    await page.waitForNetworkIdle({ idleTime: 400, timeout: 7000 }).catch(() => undefined);
    await sleep(350);
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

  private docText(page: Page): Promise<string> {
    return page.evaluate(documentTextInPage).catch(() => '');
  }
}

/** The step's fields and address, without error flags, to tell "moved on" from "showed errors". */
function stepShape(s: FormSnapshot): string {
  return s.fields.map((f) => f.label).join('#') + `@${s.url.split('?')[0]}`;
}
