// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Deletes files in `dir` last changed before `olderThanMs` ago, except `keep`. Returns the deleted paths. */
export function pruneDir(dir: string, olderThanMs: number, keep: (string | null)[] = [], now = Date.now()): string[] {
  if (!existsSync(dir)) return [];
  const kept = new Set(keep.filter((k): k is string => !!k).map((k) => resolve(k).toLowerCase()));
  const deleted: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isFile()) continue;
    const path = join(dir, e.name);
    if (kept.has(resolve(path).toLowerCase())) continue;
    try {
      if (now - statSync(path).mtimeMs > olderThanMs) {
        rmSync(path);
        deleted.push(path);
      }
    } catch {
      // In use or already gone - try again next time.
    }
  }
  return deleted;
}
