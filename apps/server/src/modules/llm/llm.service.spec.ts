// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { EventsService } from '../../common/events/events.service';
import { StorageService } from '../../common/storage/storage.service';
import { DEFAULT_SETTINGS } from '../settings/constants/default-settings.constants';
import { SettingsService } from '../settings/settings.service';
import { LlmBudgetExceededError } from './errors/llm-budget-exceeded.error';
import { LlmPurpose } from './enums/llm-purpose.enum';
import { LlmTransport } from './interfaces/llm-transport.interface';
import { LlmService } from './llm.service';

describe('LlmService daily token budget', () => {
  const fake = (kind: string, local: boolean, text: string, tokens: number) => {
    const t = {
      kind,
      model: `${kind}-model`,
      local,
      calls: 0,
      complete: jest.fn(async () => {
        t.calls++;
        return { text, promptTokens: tokens, completionTokens: 0 };
      }),
      listModels: async () => [],
    };
    return t;
  };
  const make = (chain: LlmTransport[]) => {
    const settings = { ...DEFAULT_SETTINGS, agent: { ...DEFAULT_SETTINGS.agent, tokenBudgetPerDay: 100 } };
    const llm = new LlmService(new StorageService(':memory:'), new EventsService(), {
      get: () => settings,
      onChange: () => undefined,
    } as unknown as SettingsService);
    (llm as unknown as { chain: LlmTransport[] }).chain = chain;
    return llm;
  };
  const opts = { purpose: LlmPurpose.FORM_ANSWER };

  it('falls back to the free local model once a paid model has used up the budget', async () => {
    const paid = fake('openai', false, 'paid', 150);
    const local = fake('ollama', true, 'local', 50);
    const llm = make([paid as unknown as LlmTransport, local as unknown as LlmTransport]);

    expect(await llm.complete('q1', opts)).toBe('paid');
    // 150 tokens used of a 100 budget: the paid model is skipped, the local one answers.
    expect(await llm.complete('q2', opts)).toBe('local');
    expect(paid.calls).toBe(1);
    expect(local.calls).toBe(1);
  });

  it('still reports the budget when there is no local model to fall back to', async () => {
    const paid = fake('openai', false, 'paid', 150);
    const llm = make([paid as unknown as LlmTransport]);
    await llm.complete('q1', opts);
    await expect(llm.complete('q2', opts)).rejects.toBeInstanceOf(LlmBudgetExceededError);
  });
});
