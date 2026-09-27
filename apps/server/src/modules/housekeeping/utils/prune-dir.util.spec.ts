// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { existsSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruneDir } from './prune-dir.util';

describe('pruneDir', () => {
  it('deletes only old files, and never the ones to keep', () => {
    const dir = mkdtempSync(join(tmpdir(), 'prune-'));
    const old = join(dir, 'old.png');
    const fresh = join(dir, 'fresh.png');
    const resume = join(dir, 'resume.pdf');
    for (const f of [old, fresh, resume]) writeFileSync(f, 'x');
    const longAgo = (Date.now() - 40 * 86_400_000) / 1000;
    utimesSync(old, longAgo, longAgo);
    utimesSync(resume, longAgo, longAgo);

    expect(pruneDir(dir, 30 * 86_400_000, [resume])).toEqual([old]);
    expect([existsSync(old), existsSync(fresh), existsSync(resume)]).toEqual([false, true, true]);
    expect(pruneDir(join(dir, 'missing'), 1)).toEqual([]);
  });
});
