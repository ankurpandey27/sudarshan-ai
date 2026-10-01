// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger, Optional } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { LlmPurpose } from '../llm/enums/llm-purpose.enum';
import { LlmService } from '../llm/llm.service';
import { TRANSLATE_BATCH, TRANSLATE_RETRY_MS } from './constants/language.constants';
import { looksNonEnglish } from './utils/language.util';

/**
 * English versions of questions (and options) asked in other languages, so you always understand what
 * you are answering. Each text is translated once by your AI model and kept; without an AI the page
 * falls back to the browser's own translator.
 */
@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  // Texts being translated right now, so none is translated twice at once.
  private readonly busy = new Set<string>();
  // Texts the AI could not translate, and when: not asked again for an hour (no token loop on every page load).
  private readonly failed = new Map<string, number>();

  constructor(
    private readonly storage: StorageService,
    @Optional() private readonly llm?: LlmService,
  ) {}

  /** The English already known for these texts (only those not in English and translated). */
  known(texts: string[]): Map<string, string> {
    const wanted = [...new Set(texts.filter(Boolean))];
    const out = new Map<string, string>();
    for (let i = 0; i < wanted.length; i += 400) {
      const part = wanted.slice(i, i + 400);
      for (const r of this.storage.all<{ source: string; english: string }>(
        `SELECT source, english FROM translations WHERE source IN (${part.map(() => '?').join(',')})`,
        part,
      )) {
        out.set(r.source, r.english);
      }
    }
    return out;
  }

  /**
   * Translates the texts that are not in English and not translated yet, in batches. `together`: they
   * belong to one question already known to be foreign - its options ("Conversatie") are translated even
   * when a single word does not look foreign on its own. Returns what it knows afterwards.
   */
  async translate(texts: string[], together = false): Promise<Map<string, string>> {
    const known = this.known(texts);
    const todo = [...new Set(texts)].filter(
      (t) => t && !known.has(t) && !this.busy.has(t) && (this.failed.get(t) ?? 0) < Date.now() && (together || looksNonEnglish(t)),
    );
    if (todo.length && this.llm?.isAvailable()) {
      for (let i = 0; i < todo.length; i += TRANSLATE_BATCH) {
        const batch = todo.slice(i, i + TRANSLATE_BATCH);
        batch.forEach((t) => this.busy.add(t));
        // Until it works: a failed text waits before it is tried again.
        batch.forEach((t) => this.failed.set(t, Date.now() + TRANSLATE_RETRY_MS));
        try {
          const res = await this.llm.json<{ english?: string[] }>(
            `Translate each text of a job application form into plain English. Keep the meaning exact; keep numbers, names and units.
Return JSON: {"english":["<English of text 1>", "<English of text 2>", ...]} - the same number of items, in the same order.

${JSON.stringify(batch)}`,
            { purpose: LlmPurpose.TRANSLATE, maxTokens: 200 + batch.join(' ').length * 2 },
          );
          const english = Array.isArray(res?.english) && res.english.length === batch.length ? res.english : null;
          if (english) {
            const now = new Date().toISOString();
            batch.forEach((t, j) => {
              const en = String(english[j] ?? '').trim();
              if (!en) return;
              this.storage.run(
                'INSERT INTO translations (source, english, at) VALUES (?, ?, ?) ON CONFLICT(source) DO UPDATE SET english = excluded.english, at = excluded.at',
                [t, en.slice(0, 1000), now],
              );
              known.set(t, en);
              this.failed.delete(t);
            });
          }
        } catch (err) {
          this.logger.debug(`Translation failed: ${(err as Error).message}`);
        } finally {
          batch.forEach((t) => this.busy.delete(t));
        }
      }
    }
    return known;
  }
}
