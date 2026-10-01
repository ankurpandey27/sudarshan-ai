// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'puppeteer-core';
import { StorageService } from '../../common/storage/storage.service';
import { sleep } from '../../common/utils/sleep.util';
import { isSensitive } from '../answers/utils/sensitive.util';
import { LlmPurpose } from '../llm/enums/llm-purpose.enum';
import { LlmService } from '../llm/llm.service';
import { isContextTooLong } from '../llm/utils/llm-error.util';
import { AnswerEngineService } from './answer-engine.service';
import { NEVER_ADVANCE } from './constants/form-runner.constants';
import { HIGH_STAKES_QUESTION } from './constants/inference.constants';
import { NOT_A_RESUME } from './constants/background.constants';
import { RESCUE_MAX_ACTIONS, RESCUE_MAX_IDLE, RESCUE_MAX_STEPS, RESCUE_PAUSE_AFTER, RESCUE_SIZES } from './constants/rescue.constants';
import { FieldKind } from './enums/field-kind.enum';
import { FillInstruction } from './interfaces/fill-instruction.interface';
import { FormAction, FormSnapshot } from './interfaces/form-field.interface';
import { FormRunOutcome, RunFormOptions } from './interfaces/form-run.interface';
import { RescuePlan } from './interfaces/rescue-plan.interface';
import { RescueStatus } from './interfaces/rescue-status.interface';
import { toInstruction } from './utils/field-value.util';
import { buildRescuePrompt, RESCUE_SYSTEM_PROMPT } from './utils/rescue-prompt.util';
import { stepSignature } from './utils/step-signature.util';

/** What the runner lends the rescue: reading, filling and pressing on the page, and its confirmation check. */
export interface RescueHands {
  snapshot(page: Page, scope: string | null): Promise<FormSnapshot>;
  fill(page: Page, instructions: FillInstruction[]): Promise<void>;
  click(page: Page, actionId: string): Promise<void>;
  settle(page: Page): Promise<void>;
  isConfirmed(page: Page, snap: FormSnapshot, opts: RunFormOptions): Promise<boolean>;
  confirmedByAi(page: Page, text: string): Promise<boolean>;
}

// The AI says the application went through already.
const ALREADY_SENT =
  /already (been )?(submitted|sent|applied)|application (was |has been )?(submitted|received|sent)|thank you for (applying|your application)/i;
const SUBMIT_WORDS = /\b(submit|send|apply|finish|complete|finali[sz]e|confirm)\b|absenden|envoyer|enviar|verzenden|versturen|invia|отправить|提交|送信|제출/i;
const shape = (s: FormSnapshot) => `${s.url.split('?')[0]}|${s.fields.map((f) => `${f.label}=${f.value}`).join('#')}|${s.actions.map((a) => a.text).join('#')}`;

/**
 * The last resort when the usual way gets stuck on a site Sudarshan does not know: an AI that reads the
 * page (and a screenshot, when the model takes images) and presses the controls that move the
 * application on, several per step. It only presses and chooses - typed answers still come from your
 * profile, your answers or you - never touches passwords, codes, captchas or anything that leaves the
 * application, and keeps the Submit rules. Every step it takes that ends in a confirmed application is
 * learned for that site, so the next application there needs no AI. Works with any model: images only
 * where the model takes them, shorter prompts where it asks for them, and it pauses itself if it keeps
 * failing with a model.
 */
@Injectable()
export class RescueService {
  private readonly logger = new Logger(RescueService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly answers: AnswerEngineService,
    private readonly storage: StorageService,
  ) {}

  /** Rescues are allowed now: the AI is there, and they have not kept failing with this model. */
  available(): boolean {
    return this.llm.isAvailable() && !this.status().paused;
  }

  status(): RescueStatus {
    const m = this.llm.current();
    if (!m) return { model: null, tries: 0, helped: 0, failedInARow: 0, paused: false };
    const rows = this.storage.all<{ outcome: string }>('SELECT outcome FROM rescue_runs WHERE provider = ? AND model = ? ORDER BY id DESC LIMIT 200', [
      m.provider,
      m.model,
    ]);
    let inARow = 0;
    for (const r of rows) {
      // An application that turned out to be sent already says nothing about this model.
      if (r.outcome === 'nothing to do') continue;
      if (r.outcome !== 'failed') break;
      inARow++;
    }
    const tries = rows.filter((r) => r.outcome !== 'reset' && r.outcome !== 'nothing to do').length;
    const helped = rows.filter((r) => r.outcome === 'applied' || r.outcome === 'progressed').length;
    return { model: `${m.provider} / ${m.model}`, tries, helped, failedInARow: inARow, paused: inARow >= RESCUE_PAUSE_AFTER };
  }

  /** "Try rescues again" after a pause (a new model starts fresh by itself). */
  resume(): void {
    this.record('reset', 'you', 0);
  }

  async run(page: Page, opts: RunFormOptions, hands: RescueHands, before: FormRunOutcome): Promise<FormRunOutcome> {
    const out: FormRunOutcome = { ...before, moves: [...(before.moves ?? [])] };
    const history: string[] = [`Ordinary automation stopped: ${before.detail}`];
    const goal = 'Get this job application submitted (or as far as possible without the person).';
    let idle = 0;
    let size = 0;
    let pressed = (before.moves?.length ?? 0) > 0;
    let steps = 0;
    const done = (o: FormRunOutcome, outcome: 'applied' | 'progressed' | 'failed') => {
      // Confirmed before the AI took a single step: not the rescue's doing, so not counted for or against it.
      this.record(steps === 0 && outcome !== 'failed' ? 'nothing to do' : outcome, opts.domain, steps);
      return o;
    };
    opts.onStep(`Rescue: the usual way got stuck (${before.detail}) - the AI takes a look`);

    while (steps < RESCUE_MAX_STEPS) {
      const snap = await hands.snapshot(page, opts.scopeSelector);
      if (pressed && (await hands.isConfirmed(page, snap, opts)))
        return done({ ...out, status: 'applied', detail: 'Application submitted (rescued)' }, 'applied');
      if (snap.captcha)
        return done({ ...out, status: 'captcha', detail: 'Filled - only the captcha is left; solve it and press Submit in the open tab' }, 'progressed');

      // New questions on this page are answered the usual way - your profile, your answers, the AI, or you.
      const fillable = snap.fields.filter((f) => f.kind !== FieldKind.FILE);
      const resolved = await this.answers.resolve(fillable, opts.ctx, { allowLlm: opts.allowLlm });
      out.llmCalls += resolved.stats.llmCalls;
      if (resolved.blockers.length) return done({ ...out, status: 'blocked', detail: resolved.blockers.join('; ') }, 'progressed');
      if (resolved.unresolved.length) {
        return done(
          { ...out, status: 'needs_input', unresolved: resolved.unresolved, detail: `${resolved.unresolved.length} question(s) need your answer` },
          'progressed',
        );
      }
      if (resolved.instructions.length) await hands.fill(page, resolved.instructions);

      steps++;
      out.steps++;
      await opts.onShot?.(page, `Rescue step ${steps}`);
      const plan = await this.ask(page, snap, goal, history, idle > 0 || steps === 1, (s) => (size = s), size);
      out.llmCalls++;
      if (!plan) return done({ ...out, status: 'stuck', detail: `${before.detail} - the AI could not help either` }, 'failed');
      if (plan.done && pressed) return done({ ...out, status: 'applied', detail: 'Application submitted (rescued)' }, 'applied');
      if (plan.stuck || !plan.actions?.length) {
        // "Already submitted": checked on the page itself before it counts (GoKwik, 2026-09-30).
        if (ALREADY_SENT.test(plan.why ?? '') && (await hands.confirmedByAi(page, snap.text))) {
          out.llmCalls++;
          return done({ ...out, status: 'applied', detail: 'Application submitted' }, 'applied');
        }
        return done({ ...out, status: 'stuck', detail: `${before.detail} - the AI found no way on${plan.why ? ` (${plan.why})` : ''}` }, 'failed');
      }

      const did: string[] = [];
      for (const a of plan.actions.slice(0, RESCUE_MAX_ACTIONS)) {
        if (a.click) {
          const target = [...snap.actions, ...(snap.links ?? [])].find((x) => x.id === a.click);
          if (!target || target.disabled || NEVER_ADVANCE.test(target.text.trim())) {
            did.push(`skipped unsafe or unknown control ${a.click}`);
            continue;
          }
          const sends = this.sends(target, snap) || a.submits === true;
          if (sends && opts.pauseBeforeSubmit) {
            return done({ ...out, status: 'ready_to_submit', detail: 'Filled and waiting for you to press Submit (rescued)' }, 'progressed');
          }
          await hands.click(page, target.id);
          pressed = true;
          // Learned for this site only if the application is then confirmed.
          out.moves!.push({
            domain: opts.domain,
            kind: target.kind === 'apply' ? 'apply' : 'advance',
            signature: stepSignature(snap),
            text: target.text,
            by: 'ai',
          });
          did.push(`pressed "${target.text}"`);
          await sleep(400);
        } else if (a.upload) {
          const field = snap.fields.find((f) => f.id === a.upload && f.kind === FieldKind.FILE);
          // The resume only, and only into a field that is not for something else (a photo, a certificate).
          if (!field || !opts.ctx.resumePath || NOT_A_RESUME.test(`${field.label} ${field.name}`)) {
            did.push(`skipped upload ${a.upload}`);
            continue;
          }
          await hands.fill(page, [{ id: field.id, kind: FieldKind.FILE, value: opts.ctx.resumePath, optionIndexes: [], optionIds: [] }]);
          did.push(`attached your resume to "${field.label || 'the upload'}"`);
        } else if (a.choose && a.option) {
          const field = snap.fields.find((f) => f.id === a.choose);
          const question = field ? field.label || field.placeholder : '';
          // Visa, work permit, salary, notice, dates, relocation, legal: your answer only - the question comes to you
          // with the AI's pick as a suggestion (Almedia, 2026-09-30: it chose "legally entitled to work in Germany").
          if (field && HIGH_STAKES_QUESTION.test(question)) {
            return done(
              {
                ...out,
                status: 'needs_input',
                unresolved: [{ field, suggestion: null }],
                detail: `"${question.slice(0, 80)}" needs your answer`,
              },
              'progressed',
            );
          }
          // Only options for questions about the application - never anything that identifies you.
          if (!field || !field.options.length || isSensitive(question)) {
            did.push(`skipped field ${a.choose}`);
            continue;
          }
          const ins = toInstruction(field, a.option);
          if (!ins) {
            did.push(`"${a.option}" is not an option of "${field.label}"`);
            continue;
          }
          await hands.fill(page, [ins]);
          did.push(`chose "${a.option}" for "${field.label}"`);
        }
      }
      opts.onStep(`Rescue step ${steps} (AI): ${did.join('; ') || 'nothing it could safely do'}`);
      await hands.settle(page);
      const after = await hands.snapshot(page, opts.scopeSelector);
      const moved = shape(after) !== shape(snap) || after.text !== snap.text;
      history.push(`Step ${steps}: ${did.join('; ') || 'nothing'} -> ${moved ? 'the page changed' : 'nothing changed'}`);
      if (moved) idle = 0;
      else if (++idle >= RESCUE_MAX_IDLE) return done({ ...out, status: 'stuck', detail: `${before.detail} - the AI's steps changed nothing` }, 'failed');
      if (pressed && !(await hands.isConfirmed(page, after, opts)) && opts.allowLlm && moved && (await hands.confirmedByAi(page, after.text))) {
        out.llmCalls++;
        return done({ ...out, status: 'applied', detail: 'Application submitted (rescued)' }, 'applied');
      }
    }
    return done({ ...out, status: 'stuck', detail: `${before.detail} - the AI ran out of steps` }, 'failed');
  }

  /** Pressing this sends the application (so the Submit rules apply). */
  private sends(a: FormAction, snap: FormSnapshot): boolean {
    return a.kind === 'submit' || (a.kind === 'apply' && snap.fields.length > 0) || (snap.fields.length > 0 && SUBMIT_WORDS.test(a.text));
  }

  /** One AI call: with a screenshot when useful and the model takes images; shorter when the model's limit is hit. */
  private async ask(
    page: Page,
    snap: FormSnapshot,
    goal: string,
    history: string[],
    withShot: boolean,
    setSize: (s: number) => void,
    size: number,
  ): Promise<RescuePlan | null> {
    const shot =
      withShot && this.llm.acceptsImages() !== false ? await page.screenshot({ type: 'jpeg', quality: 50, encoding: 'base64' }).catch(() => null) : null;
    for (let s = size; s < RESCUE_SIZES.length; s++) {
      try {
        const plan = await this.llm.json<RescuePlan>(buildRescuePrompt(snap, goal, history, RESCUE_SIZES[s]), {
          purpose: LlmPurpose.NAVIGATE,
          system: RESCUE_SYSTEM_PROMPT,
          maxTokens: 400,
          ...(shot ? { images: [{ mediaType: 'image/jpeg' as const, data: String(shot) }] } : {}),
        });
        setSize(s);
        return plan && typeof plan === 'object' ? plan : null;
      } catch (err) {
        if (isContextTooLong(err) && s + 1 < RESCUE_SIZES.length) {
          this.logger.log(`Prompt too long for ${this.llm.current()?.model} - trying a shorter one`);
          continue;
        }
        this.logger.warn(`Rescue step failed: ${(err as Error).message}`);
        return null;
      }
    }
    return null;
  }

  private record(outcome: string, domain: string, steps: number): void {
    const m = this.llm.current();
    if (!m) return;
    this.storage.run('INSERT INTO rescue_runs (at, provider, model, domain, outcome, steps) VALUES (?, ?, ?, ?, ?, ?)', [
      new Date().toISOString(),
      m.provider,
      m.model,
      domain,
      outcome,
      steps,
    ]);
  }
}
