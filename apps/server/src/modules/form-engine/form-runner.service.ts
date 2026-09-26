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
import { extractFormInPage } from './scripts/extract-form.script';
import { fillFieldsInPage } from './scripts/fill-fields.script';
import { documentTextInPage, pickTypeaheadOptionInPage } from './scripts/page-helpers.script';
import { NAVIGATE_SYSTEM_PROMPT, buildNavigatePrompt } from './utils/navigate-prompt.util';

const CAPTCHA_WAIT_MS = 180_000;
const ACTION_PRIORITY: Record<FormAction['kind'], number> = { submit: 4, review: 3, next: 2, apply: 1, dismiss: -1, other: 0 };

@Injectable()
export class FormRunnerService {
  private readonly logger = new Logger(FormRunnerService.name);

  constructor(
    private readonly answers: AnswerEngineService,
    private readonly recipes: RecipesService,
    private readonly llm: LlmService,
  ) {}

  snapshot(page: Page, scopeSelector: string | null): Promise<FormSnapshot> {
    return page.evaluate(extractFormInPage, scopeSelector);
  }

  async run(page: Page, opts: RunFormOptions): Promise<FormRunOutcome> {
    const out: FormRunOutcome = {
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
    let lastFingerprint = '';
    let repeats = 0;
    let force = new Set<string>();

    for (let step = 1; step <= maxSteps; step++) {
      out.steps = step;
      const snap = await this.snapshot(page, opts.scopeSelector);

      if (opts.successPattern.test(snap.text) || opts.successPattern.test(await this.docText(page))) {
        return { ...out, status: 'applied', detail: 'Application submitted' };
      }
      if (snap.captcha) {
        opts.onStep('Captcha shown - solve it in the agent browser window, I will wait 3 minutes');
        if (!(await this.waitForCaptcha(page, opts.scopeSelector))) {
          return { ...out, status: 'captcha', detail: 'Captcha was not solved in time' };
        }
        continue;
      }
      if (opts.scopeSelector && !snap.scopeFound) {
        return { ...out, status: 'closed', detail: 'The application dialog closed unexpectedly' };
      }

      const resolved = await this.answers.resolve(snap.fields, opts.ctx, { allowLlm: opts.allowLlm, force });
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

      const action = await this.chooseAction(page, snap, opts);
      if (!action) {
        return { ...out, status: 'stuck', detail: `No way forward found on ${new URL(snap.url).hostname}` };
      }
      if (action.kind === 'submit' && opts.pauseBeforeSubmit) {
        return { ...out, status: 'ready_to_submit', detail: 'Filled and waiting for you to press Submit' };
      }
      opts.onStep(`Step ${step}: "${action.text}"`);
      await this.click(page, action.id);
      await this.settle(page);

      const after = await this.snapshot(page, opts.scopeSelector);
      const fp = fingerprint(after);
      const errored = after.fields.filter((f) => f.error);
      if (fp === lastFingerprint || (fingerprint(snap) === fp && errored.length)) {
        repeats++;
        if (repeats >= 2) {
          const why = [...errored.map((f) => `${f.label}: ${f.error}`), ...after.errors].slice(0, 3).join('; ');
          return { ...out, status: 'stuck', detail: why || 'The form did not move forward' };
        }
        // Validation failed: re-answer only those fields, with the error as context.
        force = new Set(errored.map((f) => f.id));
      } else {
        repeats = 0;
        force = new Set();
      }
      lastFingerprint = fp;
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
  private async chooseAction(page: Page, snap: FormSnapshot, opts: RunFormOptions): Promise<FormAction | null> {
    const usable = snap.actions.filter((a) => !a.disabled && a.kind !== 'dismiss');
    const recipe = this.recipes.get(opts.domain);
    const learned = usable.find((a) => recipe.advanceTexts.includes(a.text.toLowerCase()));
    if (learned) return learned;
    const ranked = usable.filter((a) => a.kind !== 'other').sort((a, b) => ACTION_PRIORITY[b.kind] - ACTION_PRIORITY[a.kind]);
    if (ranked.length) return ranked[0];

    if (!opts.allowLlm || !this.llm.isAvailable() || usable.length === 0) return null;
    try {
      const pick = await this.llm.json<{ id?: string }>(
        buildNavigatePrompt('Submit the job application', snap.text, usable),
        { purpose: LlmPurpose.NAVIGATE, system: NAVIGATE_SYSTEM_PROMPT, maxTokens: 150 },
      );
      const action = usable.find((a) => a.id === pick.id);
      if (action) this.recipes.learn(opts.domain, 'advance', action.text);
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

function fingerprint(s: FormSnapshot): string {
  return s.fields.map((f) => `${f.label}|${f.error ? 'E' : ''}`).join('#') + `@${s.url.split('?')[0]}`;
}
