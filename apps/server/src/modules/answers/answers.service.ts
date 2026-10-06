// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, NotFoundException } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import {
  ANSWER_SOURCE_LABEL,
  ANSWER_SOURCE_TRUST,
  FUZZY_MATCH_THRESHOLD,
  GENERIC_QUESTION,
  MAX_PLAUSIBLE_YEARS,
  PERSONAL_DETAILS,
  YEARS_QUESTION,
} from './constants/answers.constants';
import { AnswerSource } from './enums/answer-source.enum';
import { Answer, AnswerMatch, AnswerRow } from './interfaces/answer.interface';
import { questionKey, questionSimilarity } from './utils/question-key.util';
import { toAnswer } from './utils/answer.mapper.util';
import { toCsv } from '../../common/utils/csv.util';

@Injectable()
export class AnswersService {
  // Small table; cached for fuzzy scans and dropped on every write.
  private cache: AnswerRow[] | null = null;

  constructor(private readonly storage: StorageService) {}

  lookup(question: string): AnswerMatch | null {
    if (GENERIC_QUESTION.test(question.trim())) return null;
    const key = questionKey(question);
    if (!key) return null;
    const rows = this.rows();
    const exact = rows.find((r) => r.key === key);
    if (exact) return this.match(exact, 1);
    let best: { row: AnswerRow; sim: number } | null = null;
    for (const row of rows) {
      const sim = questionSimilarity(question, row.question);
      if (sim >= FUZZY_MATCH_THRESHOLD && (!best || sim > best.sim)) best = { row, sim };
    }
    return best ? this.match(best.row, best.sim) : null;
  }

  /**
   * A saved answer about the same personal detail (PAN, Aadhaar, UAN, passport, date of birth),
   * however either question is worded - your own answers first, newest first.
   */
  lookupDetail(question: string): AnswerMatch | null {
    const detail = PERSONAL_DETAILS.find((d) => d.test.test(question));
    if (!detail) return null;
    const best = this.rows()
      .filter((r) => detail.test.test(r.question) && r.answer.trim())
      .sort(
        (a, b) => ANSWER_SOURCE_TRUST[b.source as AnswerSource] - ANSWER_SOURCE_TRUST[a.source as AnswerSource] || b.updated_at.localeCompare(a.updated_at),
      )[0];
    return best ? this.match(best, 1) : null;
  }

  /**
   * The most years you gave yourself in answers matching `about` ("How many years of Node.js?" -> 5) -
   * only your own answers and your spreadsheet, never the AI's.
   */
  yearsYouGave(about: (question: string) => boolean): number | null {
    let best: number | null = null;
    for (const row of this.rows()) {
      // "Total Experience: 5" counts as much as "How many years of experience: 5".
      if (row.source === AnswerSource.LLM || !(YEARS_QUESTION.test(row.question) || /experien/i.test(row.question)) || !about(row.question)) continue;
      for (const n of (row.answer.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)) {
        if (n <= MAX_PLAUSIBLE_YEARS && (best === null || n > best)) best = n;
      }
    }
    return best;
  }

  // A lower-trust source never overwrites a higher-trust answer.
  remember(question: string, answer: string, source: AnswerSource, fieldType: string | null = null): Answer | null {
    // "Choose an option" is not a question: one answer would be reused for unrelated fields.
    if (GENERIC_QUESTION.test(question.trim())) return null;
    const key = questionKey(question);
    const value = answer.trim();
    if (!key || !value) return null;
    const existing = this.storage.get<AnswerRow>('SELECT * FROM answers WHERE key = ?', [key]);
    const now = new Date().toISOString();
    if (existing) {
      if (ANSWER_SOURCE_TRUST[source] < ANSWER_SOURCE_TRUST[existing.source as AnswerSource]) return toAnswer(existing);
      this.storage.run('UPDATE answers SET answer = ?, source = ?, field_type = COALESCE(?, field_type), updated_at = ? WHERE id = ?', [
        value,
        source,
        fieldType,
        now,
        existing.id,
      ]);
    } else {
      this.storage.run('INSERT INTO answers (key, question, answer, field_type, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        key,
        question.trim().slice(0, 500),
        value,
        fieldType,
        source,
        now,
        now,
      ]);
    }
    this.cache = null;
    return toAnswer(this.storage.get<AnswerRow>('SELECT * FROM answers WHERE key = ?', [key])!);
  }

  markUsed(id: number): void {
    this.storage.run('UPDATE answers SET uses = uses + 1 WHERE id = ?', [id]);
  }

  list(search?: string): Answer[] {
    const rows = search
      ? this.storage.all<AnswerRow>('SELECT * FROM answers WHERE question LIKE ? OR answer LIKE ? ORDER BY uses DESC, updated_at DESC', [
          `%${search}%`,
          `%${search}%`,
        ])
      : this.storage.all<AnswerRow>('SELECT * FROM answers ORDER BY uses DESC, updated_at DESC');
    return rows.map(toAnswer);
  }

  update(id: number, answer: string, question?: string): Answer {
    const existing = this.storage.get<AnswerRow>('SELECT * FROM answers WHERE id = ?', [id]);
    if (!existing) throw new NotFoundException(`Answer ${id} not found`);
    const newQuestion = question?.trim() || existing.question;
    this.storage.run('UPDATE answers SET question = ?, key = ?, answer = ?, source = ?, updated_at = ? WHERE id = ?', [
      newQuestion,
      questionKey(newQuestion),
      answer.trim(),
      AnswerSource.USER,
      new Date().toISOString(),
      id,
    ]);
    this.cache = null;
    return toAnswer(this.storage.get<AnswerRow>('SELECT * FROM answers WHERE id = ?', [id])!);
  }

  remove(id: number): void {
    this.storage.run('DELETE FROM answers WHERE id = ?', [id]);
    this.cache = null;
  }

  /** Your whole answer memory as a CSV file - most used first, like the page shows it. */
  exportCsv(): string {
    return toCsv(
      ['Question', 'Answer', 'Source', 'Field type', 'Times used', 'Added', 'Last changed'],
      this.list().map((a) => [a.question, a.answer, ANSWER_SOURCE_LABEL[a.source], a.fieldType, a.uses, a.createdAt, a.updatedAt]),
    );
  }

  count(): number {
    return Number(this.storage.get<{ n: number }>('SELECT COUNT(*) n FROM answers')?.n ?? 0);
  }

  private rows(): AnswerRow[] {
    this.cache ??= this.storage.all<AnswerRow>('SELECT * FROM answers');
    return this.cache;
  }

  private match(row: AnswerRow, similarity: number): AnswerMatch {
    return { id: row.id, answer: row.answer, source: row.source as AnswerSource, similarity, question: row.question };
  }
}
