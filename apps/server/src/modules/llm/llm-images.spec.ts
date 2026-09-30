// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { EventsService } from '../../common/events/events.service';
import { StorageService } from '../../common/storage/storage.service';
import { DEFAULT_SETTINGS } from '../settings/constants/default-settings.constants';
import { SettingsService } from '../settings/settings.service';
import { LlmPurpose } from './enums/llm-purpose.enum';
import { CompletionRequest } from './interfaces/completion.interface';
import { LlmTransport } from './interfaces/llm-transport.interface';
import { LlmService } from './llm.service';
import { isContextTooLong } from './utils/llm-error.util';

/** A provider that either takes images or rejects any request that has one - as real ones do. */
const provider = (takesImages: boolean) => {
  const seen: CompletionRequest[] = [];
  const t = {
    kind: 'custom',
    model: takesImages ? 'vision-model' : 'text-model',
    local: true,
    complete: async (req: CompletionRequest) => {
      seen.push(req);
      if (req.images?.length && !takesImages) throw new Error('400: this model does not support image input');
      return { text: '{"ok":true}', promptTokens: 1, completionTokens: 1 };
    },
    listModels: async () => [],
  };
  return { t: t as unknown as LlmTransport, seen };
};
const make = (t: LlmTransport) => {
  const storage = new StorageService(':memory:');
  const llm = new LlmService(storage, new EventsService(), { get: () => DEFAULT_SETTINGS, onChange: () => undefined } as unknown as SettingsService);
  (llm as unknown as { chain: LlmTransport[] }).chain = [t];
  return llm;
};
const shot = [{ mediaType: 'image/jpeg' as const, data: 'aGVsbG8=' }];
const opts = { purpose: LlmPurpose.NAVIGATE, images: shot };

describe('screenshots for the AI, with any model', () => {
  it('sends them to a model that takes images, and remembers it does', async () => {
    const { t, seen } = provider(true);
    const llm = make(t);
    expect(await llm.json('go', opts)).toEqual({ ok: true });
    expect(seen[0].images).toHaveLength(1);
    expect(llm.acceptsImages()).toBe(true);
  });

  it('finds out a model does not take images, answers anyway, and never sends it one again', async () => {
    const { t, seen } = provider(false);
    const llm = make(t);
    expect(llm.acceptsImages()).toBeNull();
    expect(await llm.json('go', opts)).toEqual({ ok: true });
    expect(llm.acceptsImages()).toBe(false);
    await llm.json('go again', opts);
    // First try with, then without; afterwards only without.
    expect(seen.map((r) => !!r.images?.length)).toEqual([true, false, false]);
  });

  it('knows a "prompt too long" error when a provider says so', () => {
    expect(isContextTooLong(new Error("This model's maximum context length is 8192 tokens"))).toBe(true);
    expect(isContextTooLong(new Error('prompt is too long: 210000 tokens > 200000 maximum'))).toBe(true);
    expect(isContextTooLong(new Error('Invalid API key'))).toBe(false);
  });
});
