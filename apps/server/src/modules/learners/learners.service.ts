// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { LEARNER_LABELS, MIN_EXAMPLES, RECENT_CHECKS } from './constants/learners.constants';
import { LearnerMode } from './enums/learner-mode.enum';
import { LearnerName } from './enums/learner-name.enum';
import { LearnerMetrics, LearnerStatus } from './interfaces/learner-status.interface';
import { metricsOf } from './utils/mode.util';

interface StoredState {
  mode: LearnerMode;
  offline: LearnerMetrics | null;
  examples: number;
  note: string;
}

/**
 * Where the learners keep what they learned: their examples (from your daily applications), their
 * live checks (a prediction, then what really happened), their state, and whether you switched them
 * off. Each learner trains itself; this is their shared memory on this computer.
 */
@Injectable()
export class LearnersService {
  constructor(private readonly storage: StorageService) {}

  /** A labelled example; seen again, it counts more. */
  addExample(learner: LearnerName, text: string, label: string, source: string): void {
    const clean = text.trim().slice(0, 300);
    if (!clean || !label) return;
    this.storage.run(
      `INSERT INTO learner_examples (learner, text, label, source, seen, at) VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(learner, text, label) DO UPDATE SET seen = seen + 1, at = excluded.at`,
      [learner, clean, label, source, new Date().toISOString()],
    );
  }

  /** Examples rebuilt from history on every training (not sightings): replaced, never counted twice. */
  replaceExamples(learner: LearnerName, source: string, items: { text: string; label: string }[]): void {
    const counts = new Map<string, { text: string; label: string; n: number }>();
    for (const i of items) {
      const clean = i.text.trim().slice(0, 300);
      if (!clean || !i.label) continue;
      const k = `${clean}\u0000${i.label}`;
      counts.set(k, { text: clean, label: i.label, n: (counts.get(k)?.n ?? 0) + 1 });
    }
    const at = new Date().toISOString();
    this.storage.transaction(() => {
      this.storage.run('DELETE FROM learner_examples WHERE learner = ? AND source = ?', [learner, source]);
      for (const count of counts.values()) {
        // A sighting of the same example from another source (a rule) keeps its own row and count.
        this.storage.run('INSERT OR IGNORE INTO learner_examples (learner, text, label, source, seen, at) VALUES (?, ?, ?, ?, ?, ?)', [
          learner,
          count.text,
          count.label,
          source,
          count.n,
          at,
        ]);
      }
    });
  }

  examples(learner: LearnerName): { text: string; label: string; source: string; seen: number }[] {
    return this.storage.all('SELECT text, label, source, seen FROM learner_examples WHERE learner = ?', [learner]);
  }

  /** A live prediction, to be marked right or wrong when the real answer is known. */
  check(learner: LearnerName, input: string, predicted: string): number {
    return Number(
      this.storage.run('INSERT INTO learner_checks (learner, at, input, predicted) VALUES (?, ?, ?, ?)', [
        learner,
        new Date().toISOString(),
        input.slice(0, 300),
        predicted,
      ]).lastInsertRowid,
    );
  }

  resolve(id: number, actual: string, correct: boolean): void {
    this.storage.run('UPDATE learner_checks SET actual = ?, correct = ? WHERE id = ? AND correct IS NULL', [actual.slice(0, 300), correct ? 1 : 0, id]);
  }

  /** Open checks, oldest first. */
  openChecks(learner: LearnerName): { id: number; input: string; predicted: string }[] {
    return this.storage.all('SELECT id, input, predicted FROM learner_checks WHERE learner = ? AND correct IS NULL ORDER BY id', [learner]);
  }

  /** How it did on its most recent live checks. */
  live(learner: LearnerName): LearnerMetrics | null {
    const rows = this.storage.all<{ correct: number }>(
      'SELECT correct FROM learner_checks WHERE learner = ? AND correct IS NOT NULL ORDER BY id DESC LIMIT ?',
      [learner, RECENT_CHECKS],
    );
    return rows.length ? metricsOf(rows.length, rows.filter((r) => r.correct === 1).length, 'live, on your applications') : null;
  }

  enabled(learner: LearnerName): boolean {
    return this.storage.get<{ enabled: number }>('SELECT enabled FROM learners WHERE name = ?', [learner])?.enabled !== 0;
  }

  setEnabled(learner: LearnerName, enabled: boolean): void {
    this.storage.run('INSERT INTO learners (name, enabled) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET enabled = excluded.enabled', [
      learner,
      enabled ? 1 : 0,
    ]);
  }

  saveState(learner: LearnerName, state: StoredState): void {
    this.storage.run(
      'INSERT INTO learners (name, state, trained_at) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET state = excluded.state, trained_at = excluded.trained_at',
      [learner, JSON.stringify(state), new Date().toISOString()],
    );
  }

  /** The mode it last decided on; LEARNING until it has trained once. */
  mode(learner: LearnerName): LearnerMode {
    if (!this.enabled(learner)) return LearnerMode.OFF;
    return this.state(learner)?.mode ?? LearnerMode.LEARNING;
  }

  status(): LearnerStatus[] {
    return Object.values(LearnerName).map((name) => {
      const row = this.storage.get<{ state: string | null; trained_at: string | null }>('SELECT state, trained_at FROM learners WHERE name = ?', [name]);
      const st = row?.state ? (JSON.parse(row.state) as StoredState) : null;
      const examples = st?.examples ?? this.examples(name).length;
      const live = this.live(name);
      return {
        name,
        label: LEARNER_LABELS[name],
        mode: this.mode(name),
        enabled: this.enabled(name),
        examples,
        needed: Math.max(0, MIN_EXAMPLES[name] - examples),
        // Live checks say more than training-time ones once there are enough.
        metrics: live && live.checked >= 10 ? live : (st?.offline ?? live),
        trainedAt: row?.trained_at ?? null,
        note: st?.note ?? 'Not trained yet',
      };
    });
  }

  private state(learner: LearnerName): StoredState | null {
    const raw = this.storage.get<{ state: string | null }>('SELECT state FROM learners WHERE name = ?', [learner])?.state;
    return raw ? (JSON.parse(raw) as StoredState) : null;
  }
}
