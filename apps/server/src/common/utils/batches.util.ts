// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Runs `work` on every item, `size` at a time; each batch finishes before the next starts. */
export async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  const step = Math.max(1, Math.floor(size));
  for (let i = 0; i < items.length; i += step) await Promise.all(items.slice(i, i + step).map(work));
}
