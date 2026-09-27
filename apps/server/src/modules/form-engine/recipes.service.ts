// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { SiteRecipe } from './interfaces/site-recipe.interface';

const MAX_TEXTS = 12;

@Injectable()
export class RecipesService {
  constructor(private readonly storage: StorageService) {}

  get(domain: string): SiteRecipe {
    const row = this.storage.get<{ data: string; successes: number; failures: number }>(
      'SELECT data, successes, failures FROM recipes WHERE domain = ?',
      [domain],
    );
    const data = row ? (JSON.parse(row.data) as Partial<SiteRecipe>) : {};
    return {
      domain,
      applyTexts: data.applyTexts ?? [],
      advanceTexts: data.advanceTexts ?? [],
      successes: row?.successes ?? 0,
      failures: row?.failures ?? 0,
    };
  }

  learn(domain: string, kind: 'apply' | 'advance', text: string): void {
    const r = this.get(domain);
    const list = kind === 'apply' ? r.applyTexts : r.advanceTexts;
    const t = text.trim().toLowerCase();
    if (!t || list.includes(t)) return;
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
    return this.storage
      .all<{ domain: string }>('SELECT domain FROM recipes ORDER BY successes DESC')
      .map((r) => this.get(r.domain));
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
