// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger, Optional } from '@nestjs/common';
import { AnswersService } from '../answers/answers.service';
import { PastAnswersService } from '../answers/past-answers.service';
import { isSensitive } from '../answers/utils/sensitive.util';
import { FieldLearnerService } from '../learners/field-learner.service';
import { QuestionLearnerService } from '../learners/question-learner.service';
import { LearnerMode } from '../learners/enums/learner-mode.enum';
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
import { answerForKey, answerFromProfile, namesACountry, WORK_AUTH_QUESTION, workAuthorizationKnown } from './utils/profile-rules.util';
import { OPTIONAL_LEFT_BLANK } from './constants/form-runner.constants';
import { sameSubject } from './utils/subject.util';
import { AGE_QUESTION, GENERIC_QUESTION, YEARS_QUESTION } from '../answers/constants/answers.constants';
import { AnswerMatch } from '../answers/interfaces/answer.interface';
import { ageOn, parseBirthDate } from '../answers/utils/birth-date.util';
import { canonicalSkill, extractSkills } from '../discovery/utils/job-normalizer.util';
import { NOT_A_RESUME, REPLACES_RESUME } from './constants/background.constants';
import { HIGH_STAKES_QUESTION, PREFERENCE_QUESTION } from './constants/inference.constants';
import { aiTells, isWrittenAnswer, plainWords } from './utils/human-voice.util';
import { bareNumber, FORMAT_ERROR } from './utils/bare-number.util';
import { yesNoAsNumber } from './utils/yes-no-number.util';
import { REWRITE_AT_TELLS } from './constants/human-voice.constants';
import { UNTRUSTED_RULE, untrusted } from '../llm/utils/untrusted.util';

const RESUME_FIELD = /resume|cv\b|curriculum|bio ?data/i;
const COVER_LETTER = /cover\s*letter|motivation letter/i;

/**
 * Whether an AI answer is used: a stated fact always; an inference only for a low-stakes question - a
 * wrong guess about pay, dates, the right to work, a legal declaration or an ID number costs you, so
 * those are asked when your profile does not say. Models that do not say which it is: their "confident".
 */
function accepted(a: LlmFieldAnswer, field: FormField): boolean {
  if (a.basis === 'unknown') return false;
  if (a.basis === 'inferred') return !HIGH_STAKES_QUESTION.test(field.label || field.placeholder) && !PREFERENCE_QUESTION.test(field.label || field.placeholder);
  return a.confident !== false;
}

/**
 * A field that already shows an answer your profile clearly disagrees with: Greenhouse restored a draft with a wrong
 * school from an earlier try, and it was sent (Capco, 2026-10-03). Only facts from your profile count, and only a
 * plain mismatch - "Noida, Uttar Pradesh, India" holds "Noida", "+91 98..." holds your number.
 */
// Salary and notice too: Hirist pre-fills its questions from your Hirist profile (8 LPA current, 2 months' notice
// against your 12 LPA and 30 days, Babcom 2026-10-05) - your Sudarshan profile is the one that holds.
const IDENTITY_KEYS = new Set([
  'institution',
  'city',
  'country',
  'firstName',
  'lastName',
  'fullName',
  'email',
  'phone',
  'graduationYear',
  'educationStartYear',
  'currentCtc',
  'expectedCtc',
  'noticePeriod',
]);

function contradictsProfile(ctx: AnswerContext, field: FormField): boolean {
  if (![FieldKind.COMBOBOX, FieldKind.SELECT, FieldKind.TEXT, FieldKind.NUMBER, FieldKind.RADIO].includes(field.kind) || !field.value.trim()) return false;
  const rule = answerFromProfile(ctx, field);
  // Plain facts only - a degree or a discipline is mapped onto the site's own categories ("B.Tech." is "Bachelor's Degree").
  if (!rule?.confident || !rule.key || !IDENTITY_KEYS.has(rule.key) || !String(rule.value).trim()) return false;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const have = norm(field.value);
  const want = norm(String(rule.value));
  return !!have && !!want && !have.includes(want) && !want.includes(have);
}

/** Jobs whose AI answers are kept between tries. */
const MAX_DRAFT_JOBS = 200;
const draftKey = (f: FormField) => (f.label || f.placeholder || f.name).trim().toLowerCase();

// Order: profile rules, answer memory, one batched AI call, then the user.
@Injectable()
export class AnswerEngineService {
  private readonly logger = new Logger(AnswerEngineService.name);
  // The AI's answers for an application that stopped to ask you something, by job and question: the next try uses
  // them, so the AI is not asked again and cannot change its mind into new questions (BambooHR, 2026-10-02).
  private readonly drafts = new Map<number, Map<string, string>>();

  constructor(
    private readonly answers: AnswersService,
    private readonly llm: LlmService,
    // The type must be the class alone: a union hides it from Nest's injector.
    @Optional() private readonly pastAnswers?: PastAnswersService,
    @Optional() private readonly fieldLearner?: FieldLearnerService,
    @Optional() private readonly questionLearner?: QuestionLearnerService,
  ) {}

  async resolve(fields: FormField[], ctx: AnswerContext, opts: ResolveOptions): Promise<ResolveResult> {
    const result: ResolveResult = {
      instructions: [],
      unresolved: [],
      blockers: [],
      stats: { fields: 0, profileHits: 0, memoryHits: 0, llmCalls: 0, llmAnswers: 0 },
    };
    const forLlm: FormField[] = [];
    // Field learner checks waiting for this field's final answer.
    const pendingChecks = new Map<string, { id: number; key: string }>();
    const hints = new Map<string, string>();
    // "Authorized to work in this country?" for a job abroad: which country is unknown, so it cannot be remembered.
    const unknownCountry = new Set<string>();
    // No file field says "resume" or "CV" ("Attachments", "Drop files here"): the first one that is not
    // for something else (a photo, a cover letter, certificates) gets the resume.
    const files = fields.filter((f) => f.kind === FieldKind.FILE);
    const resumeFallback = files.some((f) => RESUME_FIELD.test(`${f.label} ${f.name}`))
      ? undefined
      : // "Upload a different file" replaces a resume the site already has (Indeed's saved one): left alone.
        files.find((f) => !NOT_A_RESUME.test(`${f.label} ${f.name}`) && !REPLACES_RESUME.test(f.label) && !/^image\//.test(f.accept ?? ''));

    for (const field of fields) {
      const forced = opts.force?.has(field.id) === true;
      const consentBox = field.kind === FieldKind.CHECKBOX && field.value !== 'true';
      if (!forced && !needsAnswer(field) && !consentBox && !contradictsProfile(ctx, field)) continue;

      if (field.kind === FieldKind.FILE) {
        this.resolveFile(field, ctx, result, resumeFallback === field);
        continue;
      }

      let fromProfile = answerFromProfile(ctx, field);
      // A default ("Yes" to onsite, "Prefer not to say") never beats your own answer to this exact question.
      if (fromProfile && !fromProfile.confident) {
        const yours = this.answers.lookup(field.label || field.placeholder);
        if (yours && yours.similarity === 1 && yours.source !== AnswerSource.LLM && toInstruction(field, yours.answer)) fromProfile = null;
      }
      // The site turned down the format of your detail ("Invalid input" for "30 days"): the same detail as a plain
      // number, decided here - the AI given the same error answered "30 days" again (Somo Media, 2026-10-02).
      if (fromProfile && forced && field.error && FORMAT_ERROR.test(field.error)) {
        // Already a number, and the site emptied the box: put it back.
        const bare = bareNumber(fromProfile.value) ?? (/^\d+(\.\d+)?$/.test(fromProfile.value.trim()) && !field.value.trim() ? fromProfile.value.trim() : null);
        const ins = bare !== null ? toInstruction(field, bare) : null;
        if (ins) {
          result.instructions.push(ins);
          result.stats.fields++;
          result.stats.profileHits++;
          continue;
        }
      }
      // A yes/no answer the site turned down as the wrong format ("Invalid input" for "Yes" in a numbers-only box):
      // the number the question means, worked out here - the AI asked again said "Yes" again (Book An Artist,
      // 2026-10-06).
      if (forced && field.error && FORMAT_ERROR.test(field.error) && [FieldKind.TEXT, FieldKind.NUMBER].includes(field.kind)) {
        const asNumber = yesNoAsNumber(field.label || field.placeholder, field.value, ctx.profile.noticePeriodDays ?? null);
        const ins = asNumber !== null ? toInstruction(field, asNumber) : null;
        if (ins) {
          result.instructions.push(ins);
          result.stats.fields++;
          result.stats.profileHits++;
          continue;
        }
      }
      // The site emptied the box (LinkedIn redraws a step after Review, CodeChavo 2026-10-05): your detail was never
      // turned down - it goes back as it was, not to the AI.
      const emptied = forced && !field.value.trim() && !(field.error && FORMAT_ERROR.test(field.error));
      if (fromProfile && (!forced || emptied)) {
        const ins = toInstruction(field, fromProfile.value);
        // Every field a rule fills with one of your details teaches the field learner that wording.
        if (ins && fromProfile.key && fromProfile.confident) this.fieldLearner?.observe(field.label || field.placeholder, fromProfile.key);
        if (ins) {
          // Leave non-consent checkboxes as they are.
          if (!(field.kind === FieldKind.CHECKBOX && ins.value === field.value)) {
            result.instructions.push(ins);
            result.stats.fields++;
            result.stats.profileHits++;
          }
          continue;
        }
        // The AI maps it onto the options - unless it identifies you, which the AI never sees.
        if (!isSensitive(field.label || field.placeholder, fromProfile.value)) {
          hints.set(field.id, `Candidate's answer: "${fromProfile.value}" - map it onto one of the options.`);
        }
      }
      if (field.kind === FieldKind.CHECKBOX && !field.required && !forced) continue;

      // A saved "Yes, authorized" from a job at home must not be reused for a job abroad.
      // One that names the country is remembered for that country - exact wording only, never a fuzzy match.
      const authAbroad = WORK_AUTH_QUESTION.test(field.label.toLowerCase()) && !workAuthorizationKnown(ctx);
      const question = field.label || field.placeholder;
      const found = this.fitting(question, field, this.answers.lookup(question)) ?? this.personalDetail(question, field);
      const remembered = !authAbroad ? found : namesACountry(field.label) && found?.similarity === 1 ? found : null;
      if (authAbroad && !namesACountry(field.label)) unknownCountry.add(field.id);
      if (remembered && !forced) {
        const ins = toInstruction(field, remembered.answer);
        if (ins) {
          this.answers.markUsed(remembered.id);
          result.instructions.push(ins);
          result.stats.fields++;
          result.stats.memoryHits++;
          continue;
        }
        if (!isSensitive(remembered.question, remembered.answer)) {
          hints.set(field.id, `Candidate previously answered a similar question: "${remembered.answer}".`);
        }
      }

      // No rule and nothing saved: the field learner may recognise which of your details this is.
      if (!forced && !authAbroad && !remembered) {
        const learned = await this.recognise(field, ctx, pendingChecks);
        if (learned) {
          result.instructions.push(learned);
          result.stats.fields++;
          result.stats.profileHits++;
          result.stats.learnedHits = (result.stats.learnedHits ?? 0) + 1;
          continue;
        }
      }

      // Optional fields are filled too when your profile has the answer - a complete application does
      // better. The AI answers them only from facts; one it cannot answer stays blank and is never asked.
      const draft = forced ? undefined : this.drafts.get(ctx.job.id)?.get(draftKey(field));
      const fromDraft = draft !== undefined ? toInstruction(field, draft) : null;
      if (fromDraft) {
        result.instructions.push(fromDraft);
        result.stats.fields++;
        result.stats.llmAnswers++;
        continue;
      }
      if (!field.required && !forced && !this.worthAsking(field)) continue;
      forLlm.push(field);
    }

    if (forLlm.length === 0) return result;

    const useLlm = opts.allowLlm && this.llm.isAvailable();
    if (useLlm) await this.addPastAnswers(forLlm, hints, unknownCountry, result);
    const llmAnswers = useLlm ? await this.askLlm(forLlm, ctx, hints, result) : null;
    const kept: [string, string][] = [];
    if (llmAnswers) await this.humanize(llmAnswers, forLlm, result);
    for (const field of forLlm) {
      const llmAnswer = llmAnswers?.get(field.id);
      // The AI's answer settles the field learner's quiet prediction for this field.
      const check = pendingChecks.get(field.id);
      if (check && llmAnswer?.value?.trim() && llmAnswer.confident !== false) this.fieldLearner?.finishCheck(check.id, ctx, field, check.key, llmAnswer.value);
      const ins = llmAnswer && llmAnswer.value.trim() ? toInstruction(field, llmAnswer.value) : null;
      if (ins && llmAnswer && accepted(llmAnswer, field)) {
        kept.push([draftKey(field), llmAnswer.value]);
        result.instructions.push(ins);
        result.stats.fields++;
        result.stats.llmAnswers++;
        if (llmAnswer.basis === 'inferred') result.stats.inferred = (result.stats.inferred ?? 0) + 1;
        // Inferred answers are worked out again each time, never saved as your own.
        if (llmAnswer.reusable && llmAnswer.basis !== 'inferred' && field.kind !== FieldKind.TEXTAREA) {
          if (opts.deferMemory) (result.toRemember ??= []).push({ fieldId: field.id, question: field.label, answer: llmAnswer.value, kind: field.kind });
          else this.answers.remember(field.label, llmAnswer.value, AnswerSource.LLM, field.kind);
        }
        continue;
      }
      if (field.required || opts.force?.has(field.id)) {
        // Without a real question it cannot be asked once and remembered - it would come back on every attempt.
        if (unknownCountry.has(field.id)) {
          result.blockers.push(
            'A work-authorization question for a job abroad does not say which country - answer it in the open tab, or fill Work authorization in your Profile',
          );
        } else if (GENERIC_QUESTION.test((field.label || field.placeholder).trim())) {
          result.blockers.push('A required question on this form has no label, so it cannot be remembered - answer it in the open tab');
        } else {
          result.unresolved.push({ field, suggestion: llmAnswer?.value?.trim() || null });
        }
      }
    }
    // Stopping to ask you: what the AI did answer waits for the next try of this job.
    if (result.unresolved.length && kept.length) this.keepDrafts(ctx.job.id, kept);
    return result;
  }

  private keepDrafts(jobId: number, answers: [string, string][]): void {
    const mine = this.drafts.get(jobId) ?? new Map<string, string>();
    for (const [k, v] of answers) mine.set(k, v);
    this.drafts.delete(jobId);
    this.drafts.set(jobId, mine);
    // The most recent jobs only.
    while (this.drafts.size > MAX_DRAFT_JOBS) this.drafts.delete(this.drafts.keys().next().value!);
  }

  /**
   * Shows the AI your own answers to questions close in meaning, found by the local model - in any
   * wording or language. The AI decides whether one answers this question; nothing is filled from them
   * directly. A work-authorization question for an unnamed country gets none (they name other countries).
   */
  private async addPastAnswers(fields: FormField[], hints: Map<string, string>, unknownCountry: Set<string>, result: ResolveResult): Promise<void> {
    if (!this.pastAnswers) return;
    const asked = fields.filter((f) => !unknownCountry.has(f.id) && (f.label || f.placeholder).trim());
    const found = await this.pastAnswers.similar(asked.map((f) => (f.label || f.placeholder).trim())).catch(() => asked.map(() => []));
    asked.forEach((f, i) => {
      // "Years of X": only past answers about X - another subject's years make the AI bolder, not righter
      // ("DevOps experience (years)" answered from "Automation experience", 2026-09-30).
      const question = (f.label || f.placeholder).trim();
      const past = (YEARS_QUESTION.test(question) ? found[i]?.filter((p) => sameSubject(question, p.question)) : found[i])
        // The question learner, once proven, hides past answers it is sure are about something else.
        ?.filter((p) => this.questionLearner?.keep(question, p.question, p.similarity) ?? true);
      if (!past?.length) return;
      const list = past.map((p) => `"${p.question}" -> "${p.answer}" (${p.similarity})`).join('; ');
      const before = hints.get(f.id);
      hints.set(f.id, `${before ? before + ' ' : ''}Candidate's own answers to similar questions: ${list}.`);
      result.stats.pastAnswerHints = (result.stats.pastAnswerHints ?? 0) + 1;
    });
  }

  /**
   * The field learner, when it recognises which of your details a field asks for: switched on (proven),
   * it fills the field with that detail's rule - units and format included; still checking itself, it
   * only records its guess, to be marked right or wrong by the field's final answer.
   */
  private async recognise(field: FormField, ctx: AnswerContext, pending: Map<string, { id: number; key: string }>): Promise<FillInstruction | null> {
    const learner = this.fieldLearner;
    const label = (field.label || field.placeholder).trim();
    if (!learner || !label || OPTIONAL_LEFT_BLANK.test(label) || field.kind === FieldKind.FILE) return null;
    const mode = learner.mode();
    if (mode !== LearnerMode.ON && mode !== LearnerMode.CHECKING) return null;
    const vote = await learner.predict(label).catch(() => null);
    if (!vote) return null;
    if (mode === LearnerMode.CHECKING) {
      pending.set(field.id, { id: learner.startCheck(label, vote.label), key: vote.label });
      return null;
    }
    const answer = answerForKey(ctx, field, vote.label);
    return answer ? toInstruction(field, answer.value) : null;
  }

  /** An optional field the AI may fill from your profile: a real question, not one only you can answer. */
  private worthAsking(field: FormField): boolean {
    const question = (field.label || field.placeholder).trim();
    if (!question || GENERIC_QUESTION.test(question)) return false;
    // A plain optional checkbox is a newsletter or marketing box; left as it is.
    if (field.kind === FieldKind.CHECKBOX) return false;
    return !OPTIONAL_LEFT_BLANK.test(question);
  }

  /**
   * A saved answer only where it really answers this question: a years question needs a number
   * ("Yes" saved for "years of NestJS" is not one), and a similar-looking question about a different
   * skill ("years of Data Science" for "years of SQL") is a different question.
   */
  private fitting(question: string, field: FormField, found: AnswerMatch | null): AnswerMatch | null {
    if (!found) return null;
    const choice = [FieldKind.RADIO, FieldKind.CHECKBOX].includes(field.kind);
    if (YEARS_QUESTION.test(question)) {
      if (!choice && !/\d/.test(found.answer)) return null;
      // Years of *what* matters, and near-identical wording hides it ("Data science" vs "Data engineering"):
      // only the same question reuses a number of years. Skills get theirs from your profile anyway.
      if (found.similarity < 1) return null;
    }
    if (found.similarity < 1) {
      const skills = (text: string) => new Set(extractSkills(text).map(canonicalSkill));
      const asked = skills(question);
      const saved = skills(found.question);
      if ((asked.size || saved.size) && (asked.size !== saved.size || [...asked].some((s) => !saved.has(s)))) return null;
    }
    return found;
  }

  /** Your PAN, Aadhaar, date of birth... however the form words it - and your age, from your date of birth. */
  private personalDetail(question: string, field: FormField): AnswerMatch | null {
    if (AGE_QUESTION.test(question)) {
      const dob = this.answers.lookupDetail('date of birth');
      const born = dob ? parseBirthDate(dob.answer) : null;
      const age = born ? ageOn(born) : null;
      return dob && age !== null && age > 14 && age < 80 ? { ...dob, answer: String(age) } : null;
    }
    const found = this.fitting(question, field, this.answers.lookupDetail(question));
    // "Do you have a PAN card?" asks whether you have one, not for its number.
    if (found && /^(do|does|have|has|are|is)\b/i.test(question.trim()) && !/^(yes|no)\b/i.test(found.answer.trim())) return { ...found, answer: 'Yes' };
    return found;
  }

  private resolveFile(field: FormField, ctx: AnswerContext, result: ResolveResult, onlyUpload = false): void {
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
    if (NOT_A_RESUME.test(field.label) || /^image\//.test(field.accept ?? '')) return;
    // Optional or not: an application with the resume attached does better.
    if (RESUME_FIELD.test(label) || field.required || /pdf|doc/i.test(field.accept ?? '') || onlyUpload) {
      const ins: FillInstruction = { id: field.id, kind: FieldKind.FILE, value: ctx.resumePath, optionIndexes: [], optionIds: [] };
      result.instructions.push(ins);
      result.stats.fields++;
      result.stats.profileHits++;
    }
  }

  /**
   * Written answers that read as AI cost an application with a recruiter. Every one gets the plain-words
   * pass (no AI); the ones that still carry several tells are rewritten together in one AI call - same
   * facts, plainer words - and kept only if the rewrite really reads plainer.
   */
  private async humanize(answers: Map<string, LlmFieldAnswer>, fields: FormField[], result: ResolveResult): Promise<void> {
    const stillAi: { id: string; question: string; text: string; tells: string[] }[] = [];
    for (const field of fields) {
      const answer = answers.get(field.id);
      if (!answer || field.options.length || !isWrittenAnswer(answer.value)) continue;
      answer.value = plainWords(answer.value);
      if (field.maxLength) answer.value = answer.value.slice(0, field.maxLength);
      const tells = aiTells(answer.value);
      if (tells.length >= REWRITE_AT_TELLS) stillAi.push({ id: field.id, question: field.label, text: answer.value, tells });
    }
    if (!stillAi.length || !this.llm.isAvailable()) return;
    try {
      const res = await this.llm.json<{ answers?: { id: string; text: string }[] }>(
        `Rewrite each answer so it reads like the candidate wrote it. Keep every fact, claim and number exactly; add none. Plain words, varied sentences, no dramatic reveals, no lists of three, at most one dash. Same language as the answer.

${untrusted('answers', JSON.stringify(stillAi.map(({ id, question, text, tells }) => ({ id, question, text, why: tells.slice(0, 5) }))))}

Return JSON: {"answers":[{"id":"<id>","text":"<rewritten>"}]}`,
        { purpose: LlmPurpose.FORM_ANSWER, maxTokens: 1500, system: UNTRUSTED_RULE },
      );
      result.stats.llmCalls++;
      for (const rewrite of res.answers ?? []) {
        const was = stillAi.find((x) => x.id === rewrite.id);
        const answer = answers.get(rewrite.id);
        const text = typeof rewrite.text === 'string' ? plainWords(rewrite.text.trim()) : '';
        // Kept only when it is really plainer and not much shorter (no facts dropped).
        if (was && answer && text && aiTells(text).length < was.tells.length && text.length >= was.text.length * 0.6) answer.value = text;
      }
    } catch {
      // The plain-words pass already ran; the answer stands.
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
      for (const answer of res.answers ?? []) {
        if (answer && typeof answer.id === 'string') map.set(answer.id, { ...answer, value: String(answer.value ?? '') });
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

  /** Saves AI answers the form showed it took (see deferMemory). */
  rememberHeld(items: { question: string; answer: string; kind: string }[]): void {
    for (const it of items) this.answers.remember(it.question, it.answer, AnswerSource.LLM, it.kind);
  }
}
