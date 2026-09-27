// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger } from '@nestjs/common';
import { AnswersService } from '../answers/answers.service';
import { AnswerSource } from '../answers/enums/answer-source.enum';
import { LlmService } from '../llm/llm.service';
import { LlmPurpose } from '../llm/enums/llm-purpose.enum';
import { FieldKind } from './enums/field-kind.enum';
import { AnswerContext } from './interfaces/answer-context.interface';
import { FillInstruction } from './interfaces/fill-instruction.interface';
import { FormField } from './interfaces/form-field.interface';
import { LlmFieldAnswer, ResolveOptions, ResolveResult, UnresolvedField } from './interfaces/resolve-result.interface';
import { ANSWER_SYSTEM_PROMPT, buildAnswerPrompt } from './utils/answer-prompt.util';
import { needsAnswer, toInstruction } from './utils/field-value.util';
import { answerFromProfile, WORK_AUTH_QUESTION, workAuthorizationKnown } from './utils/profile-rules.util';
import { GENERIC_QUESTION } from '../answers/constants/answers.constants';

const RESUME_FIELD = /resume|cv\b|curriculum|bio ?data/i;
const COVER_LETTER = /cover\s*letter|motivation letter/i;

// Order: profile rules, answer memory, one batched AI call, then the user.
@Injectable()
export class AnswerEngineService {
  private readonly logger = new Logger(AnswerEngineService.name);

  constructor(
    private readonly answers: AnswersService,
    private readonly llm: LlmService,
  ) {}

  async resolve(fields: FormField[], ctx: AnswerContext, opts: ResolveOptions): Promise<ResolveResult> {
    const result: ResolveResult = {
      instructions: [],
      unresolved: [],
      blockers: [],
      stats: { fields: 0, profileHits: 0, memoryHits: 0, llmCalls: 0, llmAnswers: 0 },
    };
    const forLlm: FormField[] = [];
    const hints = new Map<string, string>();

    for (const field of fields) {
      const forced = opts.force?.has(field.id) === true;
      const consentBox = field.kind === FieldKind.CHECKBOX && field.value !== 'true';
      if (!forced && !needsAnswer(field) && !consentBox) continue;

      if (field.kind === FieldKind.FILE) {
        this.resolveFile(field, ctx, result);
        continue;
      }

      const fromProfile = answerFromProfile(ctx, field);
      if (fromProfile && !forced) {
        const ins = toInstruction(field, fromProfile.value);
        if (ins) {
          // Leave non-consent checkboxes as they are.
          if (!(field.kind === FieldKind.CHECKBOX && ins.value === field.value)) {
            result.instructions.push(ins);
            result.stats.fields++;
            result.stats.profileHits++;
          }
          continue;
        }
        hints.set(field.id, `Candidate's answer: "${fromProfile.value}" - map it onto one of the options.`);
      }
      if (field.kind === FieldKind.CHECKBOX && !field.required && !forced) continue;

      // A saved "Yes, authorized" from a job at home must not be reused for a job abroad.
      const authAbroad = WORK_AUTH_QUESTION.test(field.label.toLowerCase()) && !workAuthorizationKnown(ctx);
      const remembered = authAbroad ? null : this.answers.lookup(field.label || field.placeholder);
      if (remembered && !forced) {
        const ins = toInstruction(field, remembered.answer);
        if (ins) {
          this.answers.markUsed(remembered.id);
          result.instructions.push(ins);
          result.stats.fields++;
          result.stats.memoryHits++;
          continue;
        }
        hints.set(field.id, `Candidate previously answered a similar question: "${remembered.answer}".`);
      }

      if (!field.required && !forced && field.kind !== FieldKind.TEXTAREA) {
        // Optional and unknown: leave it blank.
        continue;
      }
      forLlm.push(field);
    }

    if (forLlm.length === 0) return result;

    const llmAnswers = opts.allowLlm && this.llm.isAvailable() ? await this.askLlm(forLlm, ctx, hints, result) : null;
    for (const field of forLlm) {
      const a = llmAnswers?.get(field.id);
      const ins = a && a.value.trim() ? toInstruction(field, a.value) : null;
      if (ins && a && a.confident !== false) {
        result.instructions.push(ins);
        result.stats.fields++;
        result.stats.llmAnswers++;
        if (a.reusable && field.kind !== FieldKind.TEXTAREA) {
          this.answers.remember(field.label, a.value, AnswerSource.LLM, field.kind);
        }
        continue;
      }
      if (field.required || opts.force?.has(field.id)) {
        // Without a real question it cannot be asked once and remembered - it would come back on every attempt.
        if (GENERIC_QUESTION.test((field.label || field.placeholder).trim())) {
          result.blockers.push('A required question on this form has no label, so it cannot be remembered - answer it in the open tab');
        } else {
          result.unresolved.push({ field, suggestion: a?.value?.trim() || null });
        }
      }
    }
    return result;
  }

  private resolveFile(field: FormField, ctx: AnswerContext, result: ResolveResult): void {
    const label = `${field.label} ${field.name} ${field.accept ?? ''}`;
    if (COVER_LETTER.test(label)) {
      if (field.required) result.blockers.push(`Cover letter upload required: "${field.label}"`);
      return;
    }
    if (!ctx.resumePath) {
      if (field.required) result.blockers.push('Upload your resume PDF first - this form requires it');
      return;
    }
    // In practice the first file input is the resume, labelled or not.
    if (RESUME_FIELD.test(label) || field.required || /pdf|doc/i.test(field.accept ?? '')) {
      const ins: FillInstruction = { id: field.id, kind: FieldKind.FILE, value: ctx.resumePath, optionIndexes: [], optionIds: [] };
      result.instructions.push(ins);
      result.stats.fields++;
      result.stats.profileHits++;
    }
  }

  private async askLlm(
    fields: FormField[],
    ctx: AnswerContext,
    hints: Map<string, string>,
    result: ResolveResult,
  ): Promise<Map<string, LlmFieldAnswer> | null> {
    try {
      result.stats.llmCalls++;
      const res = await this.llm.json<{ answers?: LlmFieldAnswer[] }>(buildAnswerPrompt(ctx, fields, hints), {
        purpose: LlmPurpose.FORM_ANSWER,
        system: ANSWER_SYSTEM_PROMPT,
        maxTokens: Math.min(4000, 300 + fields.length * 180),
      });
      const map = new Map<string, LlmFieldAnswer>();
      for (const a of res.answers ?? []) {
        if (a && typeof a.id === 'string') map.set(a.id, { ...a, value: String(a.value ?? '') });
      }
      return map;
    } catch (err) {
      this.logger.warn(`LLM could not answer ${fields.length} field(s): ${(err as Error).message}`);
      return null;
    }
  }

  static toPending(unresolved: UnresolvedField[]): { question: string; fieldType: string; options: string[]; suggestion: string | null }[] {
    return unresolved.map((u) => ({
      question: u.field.label || u.field.placeholder || u.field.name,
      fieldType: u.field.kind,
      options: u.field.options.filter((o) => o.trim() && !/^(select|choose)/i.test(o)),
      suggestion: u.suggestion,
    }));
  }
}
