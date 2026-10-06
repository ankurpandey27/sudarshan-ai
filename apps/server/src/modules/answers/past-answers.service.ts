// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { EmbeddingsService } from '../../common/embeddings/embeddings.service';
import { EMBEDDING_MODEL } from '../../common/embeddings/constants/embeddings.constants';
import { cosine, fromBlob, toBlob } from '../../common/embeddings/utils/vector.util';
import { PAST_ANSWER_MIN_SIMILARITY, PAST_ANSWERS_SHOWN } from './constants/answers.constants';
import { AnswerSource } from './enums/answer-source.enum';
import { AnswerRow } from './interfaces/answer.interface';
import { PastAnswer } from './interfaces/past-answer.interface';
import { isSensitive } from './utils/sensitive.util';

/**
 * Your saved answers closest in meaning to a new question, in any wording or language - found by the
 * local meaning model and handed to the AI, which decides whether they answer this question. They are
 * never filled in by themselves: similar-looking questions can ask opposite things ("current" vs
 * "expected" CTC, 10th vs 12th board), measured on real answers on 2026-09-30.
 * Only your own answers and your spreadsheet's are used, so one AI guess never spreads.
 */
@Injectable()
export class PastAnswersService {
  // Vectors by question key; saved answers change rarely, and a changed question gets a new key.
  private readonly vectors = new Map<string, Float32Array>();

  constructor(
    private readonly storage: StorageService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  /** For each question, your closest saved answers; empty lists when the model is not available. */
  async similar(questions: string[], exclude: (a: PastAnswer) => boolean = () => false): Promise<PastAnswer[][]> {
    const none = questions.map(() => [] as PastAnswer[]);
    if (questions.length === 0) return none;
    const rows = this.storage.all<AnswerRow>('SELECT * FROM answers WHERE source <> ?', [AnswerSource.LLM]);
    if (rows.length === 0) return none;
    if (!(await this.ensureVectors(rows))) return none;
    const asked = await this.embeddings.embed(questions);
    if (!asked) return none;
    return asked.map((q) =>
      rows
        .map((r) => ({ question: r.question, answer: r.answer, similarity: Math.round(cosine(q, this.vectors.get(r.key)!) * 100) / 100 }))
        // Nothing that identifies you (PAN, phone, date of birth...) is ever shown to the AI.
        .filter((p) => p.similarity >= PAST_ANSWER_MIN_SIMILARITY && !isSensitive(p.question, p.answer) && !exclude(p))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, PAST_ANSWERS_SHOWN),
    );
  }

  /** Your saved answers with their meaning-vectors (for learning which questions are the same); null without the model. */
  async trusted(): Promise<{ question: string; answer: string; vector: Float32Array }[] | null> {
    const rows = this.storage.all<AnswerRow>('SELECT * FROM answers WHERE source <> ?', [AnswerSource.LLM]);
    if (!(await this.ensureVectors(rows))) return null;
    return rows.map((r) => ({ question: r.question, answer: r.answer, vector: this.vectors.get(r.key)! }));
  }

  /** Every saved question has its vector: read from the database, or computed once and stored. */
  private async ensureVectors(rows: AnswerRow[]): Promise<boolean> {
    const missing = rows.filter((r) => !this.vectors.has(r.key));
    if (missing.length === 0) return true;
    for (const row of this.storage.all<{ key: string; vector: Uint8Array }>('SELECT key, vector FROM answer_vectors WHERE model = ?', [EMBEDDING_MODEL])) {
      this.vectors.set(row.key, fromBlob(row.vector));
    }
    const todo = rows.filter((r) => !this.vectors.has(r.key));
    if (todo.length === 0) return true;
    const vs = await this.embeddings.embed(todo.map((r) => r.question));
    if (!vs) return false;
    this.storage.transaction(() => {
      todo.forEach((r, i) => {
        this.vectors.set(r.key, vs[i]);
        this.storage.run('INSERT OR REPLACE INTO answer_vectors (key, model, vector) VALUES (?, ?, ?)', [r.key, EMBEDDING_MODEL, toBlob(vs[i])]);
      });
    });
    return true;
  }
}
