// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { APPLY_WORDING, NEVER_ADVANCE } from './constants/form-runner.constants';
import { LearnedMove } from './interfaces/learned-move.interface';
import { SiteRecipe } from './interfaces/site-recipe.interface';

const MAX_TEXTS = 12;

const usable = (kind: 'apply' | 'advance', text: string): boolean => !NEVER_ADVANCE.test(text) && (kind === 'advance' || APPLY_WORDING.test(text));

@Injectable()
export class RecipesService {
  constructor(private readonly storage: StorageService) {}

  get(domain: string): SiteRecipe {
    const row = this.storage.get<{ data: string; successes: number; failures: number }>('SELECT data, successes, failures FROM recipes WHERE domain = ?', [
      domain,
    ]);
    const data = row ? (JSON.parse(row.data) as Partial<SiteRecipe>) : {};
    return {
      domain,
      // Anything saved before these rules existed is filtered here too.
      applyTexts: (data.applyTexts ?? []).filter((t) => usable('apply', t)),
      advanceTexts: (data.advanceTexts ?? []).filter((t) => usable('advance', t)),
      successes: row?.successes ?? 0,
      failures: row?.failures ?? 0,
    };
  }

  /**
   * The application was confirmed: buttons the AI picked or you clicked become part of the site's
   * recipe. The built-in rules' own picks need no recipe - the rules find them again anyway.
   */
  confirm(moves: LearnedMove[]): void {
    for (const m of moves) if (m.by !== 'rules') this.learn(m.domain, m.kind, m.text);
  }

  learn(domain: string, kind: 'apply' | 'advance', text: string): void {
    const r = this.get(domain);
    const list = kind === 'apply' ? r.applyTexts : r.advanceTexts;
    const t = text.trim().toLowerCase();
    if (!t || list.includes(t) || !usable(kind, t)) return;
    list.unshift(t);
    list.splice(MAX_TEXTS);
    this.save(r);
  }

  outcome(domain: string, ok: boolean): void {
    const r = this.get(domain);
    if (ok) r.successes++;
    else r.failures++;
    this.save(r);
  }

  list(): SiteRecipe[] {
    return this.storage.all<{ domain: string }>('SELECT domain FROM recipes ORDER BY successes DESC').map((r) => this.get(r.domain));
  }

  private save(r: SiteRecipe): void {
    this.storage.run(
      `INSERT INTO recipes (domain, data, successes, failures, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(domain) DO UPDATE SET data = excluded.data, successes = excluded.successes,
         failures = excluded.failures, updated_at = excluded.updated_at`,
      [r.domain, JSON.stringify({ applyTexts: r.applyTexts, advanceTexts: r.advanceTexts }), r.successes, r.failures, new Date().toISOString()],
    );
  }
}
