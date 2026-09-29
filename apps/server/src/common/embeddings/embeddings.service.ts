// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../../modules/settings/settings.service';
import { EMBEDDING_BATCH, EMBEDDING_DTYPE, EMBEDDING_LOAD_TIMEOUT_MS, EMBEDDING_MODEL } from './constants/embeddings.constants';
import { EmbeddingStatus } from './interfaces/embedding-status.interface';
import { pickModelDir } from './utils/model-dir.util';

type Extractor = (texts: string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

/**
 * Turns text into meaning-vectors with a small model that runs on this computer, in any language -
 * no GPU, nothing sent anywhere. Downloaded once into the data folder. When it cannot run (switched
 * off, no download, too little memory), every caller gets null and carries on without it.
 */
@Injectable()
export class EmbeddingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmbeddingsService.name);
  private extractor: Extractor | null = null;
  private loading: Promise<Extractor | null> | null = null;
  private failure: string | null = null;

  constructor(
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    // Warmed in the background: nothing waits for it.
    if (this.enabled()) void this.load();
  }

  status(): EmbeddingStatus {
    const state = !this.enabled() ? 'off' : this.extractor ? 'ready' : this.failure ? 'unavailable' : 'loading';
    return { state, model: EMBEDDING_MODEL, reason: state === 'unavailable' ? this.failure : null };
  }

  /** Meaning-vectors for the texts, or null when the model is off or cannot run. */
  async embed(texts: string[]): Promise<Float32Array[] | null> {
    if (!this.enabled() || texts.length === 0) return texts.length === 0 ? [] : null;
    const extractor = this.extractor ?? (await this.load());
    if (!extractor) return null;
    try {
      const out: Float32Array[] = [];
      for (let i = 0; i < texts.length; i += EMBEDDING_BATCH) {
        const batch = texts.slice(i, i + EMBEDDING_BATCH).map((t) => t.slice(0, 500));
        const rows = (await extractor(batch, { pooling: 'mean', normalize: true })).tolist();
        out.push(...rows.map((r) => Float32Array.from(r)));
      }
      return out;
    } catch (err) {
      this.logger.warn(`Meaning model failed on a request: ${(err as Error).message}`);
      return null;
    }
  }

  private enabled(): boolean {
    return this.settings.get().agent.pastAnswers !== false;
  }

  private load(): Promise<Extractor | null> {
    if (this.extractor) return Promise.resolve(this.extractor);
    if (this.failure) return Promise.resolve(null);
    this.loading ??= this.start().finally(() => (this.loading = null));
    return this.loading;
  }

  private async start(): Promise<Extractor | null> {
    const started = Date.now();
    try {
      // The project's models folder (filled by npm install), else the data folder.
      const dir = pickModelDir(this.config.getOrThrow<string>('paths.models'), this.config.getOrThrow<string>('paths.modelsFallback'));
      // Loaded only when used, so the app starts (and its tests run) without it.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const lib = require('@huggingface/transformers') as typeof import('@huggingface/transformers');
      lib.env.cacheDir = dir;
      lib.env.localModelPath = dir;
      const ready = lib.pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: EMBEDDING_DTYPE });
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('took too long to start')), EMBEDDING_LOAD_TIMEOUT_MS).unref());
      this.extractor = (await Promise.race([ready, timeout])) as unknown as Extractor;
      this.logger.log(`Meaning model ready in ${Math.round((Date.now() - started) / 1000)} s`);
      return this.extractor;
    } catch (err) {
      this.failure = (err as Error).message.slice(0, 300);
      this.logger.warn(`Meaning model unavailable - carrying on without it: ${this.failure}`);
      return null;
    }
  }
}
