// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { NEVER_ADVANCE } from './constants/form-runner.constants';
import { PlaybookMove } from './interfaces/playbook-move.interface';

/**
 * Per site and per kind of step: which button moved the form forward. Learned from the agent's
 * own runs and from forms you finish by hand, so a changed page is recovered once, not every time.
 */
@Injectable()
export class PlaybookService {
  constructor(private readonly storage: StorageService) {}

  /** Buttons that have worked on this step more often than not, best first. */
  preferred(domain: string, signature: string): string[] {
    return this.moves(domain, signature)
      .filter((m) => m.ok > m.fail && !NEVER_ADVANCE.test(m.action))
      .map((m) => m.action);
  }

  moves(domain: string, signature: string): PlaybookMove[] {
    return this.storage.all<PlaybookMove>('SELECT action, ok, fail FROM playbook_steps WHERE domain = ? AND signature = ? ORDER BY (ok - fail) DESC, ok DESC', [
      domain,
      signature,
    ]);
  }

  record(domain: string, signature: string, action: string, moved: boolean): void {
    const text = action.trim().toLowerCase();
    if (!domain || !text || (moved && NEVER_ADVANCE.test(text))) return;
    this.storage.run(
      `INSERT INTO playbook_steps (domain, signature, action, ok, fail, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(domain, signature, action) DO UPDATE SET ok = ok + excluded.ok, fail = fail + excluded.fail, updated_at = excluded.updated_at`,
      [domain, signature, text, moved ? 1 : 0, moved ? 0 : 1, new Date().toISOString()],
    );
  }
}
