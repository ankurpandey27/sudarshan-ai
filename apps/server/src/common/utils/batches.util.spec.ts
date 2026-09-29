// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { inBatches } from './batches.util';

describe('inBatches', () => {
  it('works on every item, never more than `size` at once', async () => {
    let running = 0;
    let most = 0;
    const done: number[] = [];
    await inBatches([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 5));
      done.push(n);
      running--;
    });
    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(most).toBe(3);
  });
});
