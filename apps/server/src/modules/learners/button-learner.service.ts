// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { EmbeddingsService } from '../../common/embeddings/embeddings.service';
import { FormAction } from '../form-engine/interfaces/form-field.interface';
import { NEVER_ADVANCE } from '../form-engine/constants/form-runner.constants';
import { KNN_K, KNN_MIN_AGREEMENT, KNN_MIN_SIMILARITY, MIN_EXAMPLES } from './constants/learners.constants';
import { LearnerMode } from './enums/learner-mode.enum';
import { LearnerName } from './enums/learner-name.enum';
import { KnnVote, LabelledVector } from './interfaces/labelled-vector.interface';
import { LearnersService } from './learners.service';
import { knnVote } from './utils/knn.util';
import { decideMode, metricsOf } from './utils/mode.util';

const L = LearnerName.BUTTON;
const FORWARD = 'forward';
const NOT = 'not';

/**
 * Learns which buttons move an application forward, from every site Sudarshan applied on: a button
 * that led to confirmed applications is "forward", one that led into dead ends is not. On a site it
 * has never seen - any wording, any language - it can then pick the button that moves on, before
 * asking the AI. Never a button that leaves or deletes an application.
 */
@Injectable()
export class ButtonLearnerService {
  private readonly logger = new Logger(ButtonLearnerService.name);
  private readonly vectors = new Map<string, Float32Array>();
  private examples: LabelledVector[] = [];

  constructor(
    private readonly learners: LearnersService,
    private readonly embeddings: EmbeddingsService,
    private readonly storage: StorageService,
  ) {}

  mode(): LearnerMode {
    return this.learners.mode(L);
  }

  /** The button that most clearly moves forward, when switched on and sure; null otherwise. */
  async pick(actions: FormAction[]): Promise<{ action: FormAction; vote: KnnVote } | null> {
    if (this.mode() !== LearnerMode.ON || !this.examples.length) return null;
    const usable = actions.filter((a) => !a.disabled && a.kind !== 'dismiss' && !NEVER_ADVANCE.test(a.text.trim()));
    if (!usable.length) return null;
    const vs = await this.embeddings.embed(usable.map((a) => a.text.trim().toLowerCase()));
    if (!vs) return null;
    const votes = usable
      .map((action, i) => ({ action, vote: this.confident(knnVote(vs[i], this.examples, KNN_K)) }))
      .filter((x): x is { action: FormAction; vote: KnnVote } => x.vote?.label === FORWARD)
      .sort((a, b) => b.vote.similarity - a.vote.similarity);
    // Two different buttons both look like "forward": not sure which - leave it to the AI.
    return votes.length === 1 || (votes.length > 1 && votes[0].vote.similarity - votes[1].vote.similarity > 0.1) ? votes[0] : null;
  }

  async train(): Promise<void> {
    this.collect();
    const rows = this.learners.examples(L);
    const texts = rows.map((r) => r.text).filter((t) => !this.vectors.has(t));
    if (texts.length) {
      const vs = await this.embeddings.embed(texts);
      if (!vs) return;
      texts.forEach((t, i) => this.vectors.set(t, vs[i]));
    }
    this.examples = rows.map((r) => ({ text: r.text, label: r.label, vector: this.vectors.get(r.text)!, weight: r.seen }));

    // Each button left out in turn: would the others have told it right?
    let made = 0;
    let right = 0;
    for (const e of this.examples) {
      const vote = this.confident(knnVote(e.vector, this.examples, KNN_K, (x) => x.text === e.text));
      if (!vote) continue;
      made++;
      if (vote.label === e.label) right++;
    }
    const offline = metricsOf(made, right, 'buttons it had not seen');
    const mode = decideMode({ enabled: this.learners.enabled(L), examples: this.examples.length, min: MIN_EXAMPLES[L], offline, live: null });
    const note =
      mode === LearnerMode.ON
        ? `Picks the button that moves on, on new sites - right ${right} of ${made} times`
        : mode === LearnerMode.CHECKING
          ? `Checking itself before it presses anything (${right} of ${made} right so far)`
          : mode === LearnerMode.LEARNING
            ? `Collecting examples (${this.examples.length} of ${MIN_EXAMPLES[L]})`
            : 'Switched off';
    this.learners.saveState(L, { mode, offline, examples: this.examples.length, note });
    this.logger.log(`Button learner: ${this.examples.length} examples, ${note}`);
  }

  private confident(vote: KnnVote | null): KnnVote | null {
    return vote && vote.similarity >= KNN_MIN_SIMILARITY && vote.agreement >= KNN_MIN_AGREEMENT ? vote : null;
  }

  /** Buttons from confirmed applications (forward) and dead ends (not), on every site. */
  private collect(): void {
    const forward: { text: string; label: string }[] = [];
    const dead: { text: string; label: string }[] = [];
    const recipes: { text: string; label: string }[] = [];
    const steps = this.storage.all<{ action: string; ok: number; fail: number }>(
      'SELECT action, SUM(ok) ok, SUM(fail) fail FROM playbook_steps GROUP BY action',
    );
    for (const s of steps) {
      const text = s.action.trim().toLowerCase();
      if (!text || NEVER_ADVANCE.test(text)) continue;
      if (s.ok > s.fail) forward.push({ text, label: FORWARD });
      else if (s.fail > 0 && s.ok === 0) dead.push({ text, label: NOT });
    }
    for (const r of this.storage.all<{ data: string }>('SELECT data FROM recipes')) {
      try {
        const d = JSON.parse(r.data) as { applyTexts?: string[]; advanceTexts?: string[] };
        for (const t of [...(d.applyTexts ?? []), ...(d.advanceTexts ?? [])]) {
          if (t && !NEVER_ADVANCE.test(t)) recipes.push({ text: t.toLowerCase(), label: FORWARD });
        }
      } catch {
        // A damaged recipe teaches nothing.
      }
    }
    this.learners.replaceExamples(L, 'confirmed', forward);
    this.learners.replaceExamples(L, 'dead end', dead);
    this.learners.replaceExamples(L, 'recipe', recipes);
  }
}
