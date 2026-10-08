// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { EmbeddingsService } from '../../common/embeddings/embeddings.service';
import { AnswerSource } from '../answers/enums/answer-source.enum';
import { FieldKind } from '../form-engine/enums/field-kind.enum';
import { AnswerContext } from '../form-engine/interfaces/answer-context.interface';
import { FormField } from '../form-engine/interfaces/form-field.interface';
import { answerForKey, ruleKeyFor } from '../form-engine/utils/profile-rules.util';
import { ProfileService } from '../profile/profile.service';
import { KNN_K, KNN_MIN_AGREEMENT, KNN_MIN_SIMILARITY, MIN_EXAMPLES } from './constants/learners.constants';
import { LearnerMode } from './enums/learner-mode.enum';
import { LearnerName } from './enums/learner-name.enum';
import { KnnVote, LabelledVector } from './interfaces/labelled-vector.interface';
import { LearnersService } from './learners.service';
import { knnVote } from './utils/knn.util';
import { decideMode, metricsOf } from './utils/mode.util';

const LEARNER = LearnerName.FIELD;
const same = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9@.+]+/g, '') === b.toLowerCase().replace(/[^a-z0-9@.+]+/g, '');
// Yes/No says nothing about which detail was asked.
const TELLS_NOTHING = /^(yes|no|y|n|true|false|na|n\/a|none|-|0|1)$/i;

/**
 * Learns which of your details a form field asks for, from what Sudarshan AI does every day: every field
 * a rule fills is an example, and so is every question you answered yourself with one of your details
 * ("Contact No" -> your phone) - the wordings the rules missed. It then recognises new wordings and
 * languages the same way, and fills them with the same rule (units and format included).
 */
@Injectable()
export class FieldLearnerService {
  private readonly logger = new Logger(FieldLearnerService.name);
  private readonly vectors = new Map<string, Float32Array>();
  private examples: LabelledVector[] = [];

  constructor(
    private readonly learners: LearnersService,
    private readonly embeddings: EmbeddingsService,
    private readonly storage: StorageService,
    private readonly profile: ProfileService,
  ) {}

  /** A rule filled this field with this detail. */
  observe(label: string, key: string): void {
    this.learners.addExample(LEARNER, label, key, 'rule');
  }

  mode(): LearnerMode {
    return this.learners.mode(LEARNER);
  }

  /** Which detail this field asks for, when the nearest examples clearly agree; null otherwise. */
  async predict(label: string): Promise<KnnVote | null> {
    if (!this.examples.length || !label.trim()) return null;
    const [v] = (await this.embeddings.embed([label])) ?? [];
    if (!v) return null;
    return this.confident(knnVote(v, this.examples, KNN_K));
  }

  /** Starts a live check; the answer the field finally gets says whether the prediction was right. */
  startCheck(label: string, key: string): number {
    return this.learners.check(LEARNER, label, key);
  }

  /** Right when the field's final answer is what that detail would have filled. */
  finishCheck(id: number, ctx: AnswerContext, field: FormField, key: string, finalValue: string): void {
    const expected = answerForKey(ctx, field, key)?.value;
    if (expected === undefined) return;
    this.learners.resolve(id, finalValue, same(expected, finalValue));
  }

  /** Rebuilds from all examples: history, rules, your answers; then measures itself and picks its mode. */
  async train(): Promise<void> {
    this.backfill();
    const rows = this.learners.examples(LEARNER);
    const texts = rows.map((r) => r.text).filter((t) => !this.vectors.has(t));
    if (texts.length) {
      const vs = await this.embeddings.embed(texts);
      if (!vs) return;
      texts.forEach((t, i) => this.vectors.set(t, vs[i]));
    }
    this.examples = rows.map((r) => ({ text: r.text, label: r.label, vector: this.vectors.get(r.text)!, weight: r.seen }));
    this.resolveOpenChecks();

    // Measured on the hard cases - your own answers the rules missed - each left out in turn.
    const hard = this.examples.filter((e) => rows.find((r) => r.text === e.text && r.label === e.label)?.source === 'you');
    const pool = hard.length >= 20 ? hard : this.examples;
    let made = 0;
    let right = 0;
    for (const e of pool) {
      const vote = this.confident(knnVote(e.vector, this.examples, KNN_K, (x) => x.text === e.text));
      if (!vote) continue;
      made++;
      if (vote.label === e.label) right++;
    }
    const offline = metricsOf(made, right, pool === hard ? 'your own answers it had not seen' : 'examples it had not seen');
    const mode = decideMode({ enabled: this.learners.enabled(LEARNER), examples: this.examples.length, min: MIN_EXAMPLES[LEARNER], offline, live: this.learners.live(LEARNER) });
    const note =
      mode === LearnerMode.ON
        ? `Fills fields it recognises - right ${right} of ${made} times on ${offline.how}`
        : mode === LearnerMode.CHECKING
          ? `Checking itself before it fills anything (${right} of ${made} right so far)`
          : mode === LearnerMode.LEARNING
            ? `Collecting examples (${this.examples.length} of ${MIN_EXAMPLES[LEARNER]})`
            : 'Switched off';
    this.learners.saveState(LEARNER, { mode, offline, examples: this.examples.length, note });
    this.logger.log(`Field learner: ${this.examples.length} examples, ${note}`);
  }

  private confident(vote: KnnVote | null): KnnVote | null {
    return vote && vote.similarity >= KNN_MIN_SIMILARITY && vote.agreement >= KNN_MIN_AGREEMENT ? vote : null;
  }

  /** Every question ever seen, labelled by the rules; and your own answers that are one of your details. */
  private backfill(): void {
    const ctx = this.context();
    const history: { text: string; label: string }[] = [];
    const yours: { text: string; label: string }[] = [];
    const questions = this.storage.all<{ question: string; answer: string | null; source: string | null }>(
      `SELECT question, answer, source FROM answers UNION ALL SELECT question, NULL, NULL FROM pending_questions`,
    );
    for (const question of questions) {
      const label = question.question.trim();
      if (!label || label.length > 150) continue;
      const byRule = ruleKeyFor(label);
      if (byRule) {
        history.push({ text: label, label: byRule });
        continue;
      }
      // You answered it yourself with one of your details: a wording the rules missed.
      if (!question.answer || question.source === AnswerSource.LLM || TELLS_NOTHING.test(question.answer.trim())) continue;
      const field = this.field(label);
      const keys = [
        'phone',
        'email',
        'fullName',
        'firstName',
        'lastName',
        'city',
        'linkedin',
        'github',
        'noticePeriod',
        'currentCtc',
        'expectedCtc',
        'currentCompany',
        'currentTitle',
        'dateOfBirth',
        'postalCode',
      ];
      const matches = keys.filter((k) => {
        const value = answerForKey(ctx, field, k)?.value;
        return !!value && same(value, question.answer!);
      });
      // Exactly one detail fits; two (first name = full name) would be a guess.
      if (matches.length === 1) yours.push({ text: label, label: matches[0] });
    }
    this.learners.replaceExamples(LEARNER, 'history', history);
    this.learners.replaceExamples(LEARNER, 'you', yours);
  }

  /** Live checks whose question you have answered since. */
  private resolveOpenChecks(): void {
    const ctx = this.context();
    for (const check of this.learners.openChecks(LEARNER)) {
      const yours = this.storage.get<{ answer: string }>(`SELECT answer FROM answers WHERE question = ? AND source <> ?`, [check.input, AnswerSource.LLM]);
      if (yours) this.finishCheck(check.id, ctx, this.field(check.input), check.predicted, yours.answer);
    }
  }

  private context(): AnswerContext {
    return {
      profile: this.profile.get(),
      job: { id: 0, title: '', company: '', location: '', description: '' },
      resumePath: null,
      skillYears: () => null,
    };
  }

  private field(label: string): FormField {
    return {
      id: 'f',
      kind: FieldKind.TEXT,
      label,
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
  }
}
