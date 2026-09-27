// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AgentService } from './agent.service';

describe('AgentService.applyNow', () => {
  it('never runs two applications at once, even while the browser is still starting', async () => {
    let browserUp!: () => void;
    const apply = jest.fn(async () => ({ status: 'applied', detail: 'ok' }));
    // Only the parts applyNow touches.
    const agent = Object.assign(Object.create(AgentService.prototype) as object, {
      applying: null,
      running: false,
      jobs: { get: (id: number) => ({ id, title: 'Backend', company: 'Acme' }) },
      browser: { ensure: () => new Promise<void>((r) => (browserUp = r)) },
      apply: { apply },
      setPhase: () => undefined,
    }) as unknown as AgentService;

    const first = agent.applyNow(1);
    // A second click (or the agent loop) arrives while the browser is still launching.
    expect(await agent.applyNow(2)).toEqual({ status: 'busy', detail: 'Another application is in progress' });
    browserUp();
    expect(await first).toEqual({ status: 'applied', detail: 'ok' });
    expect(apply).toHaveBeenCalledTimes(1);
    // Free again afterwards.
    expect((agent as unknown as { applying: unknown }).applying).toBeNull();
  });
});
