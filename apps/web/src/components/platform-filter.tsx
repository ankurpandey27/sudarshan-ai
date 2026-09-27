// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { cn, PLATFORMS } from '../lib/format';
import type { JobPlatform } from '../lib/types';
import { PlatformDot } from './platform-badge';

/** "All 35 · LinkedIn 20 · Naukri 12 · Instahyre 3" - click one to see only its jobs. */
export function PlatformFilter({
  counts,
  value,
  onChange,
}: {
  counts: Partial<Record<JobPlatform, number>> | undefined;
  value: JobPlatform | '';
  onChange: (p: JobPlatform | '') => void;
}) {
  const total = Object.values(counts ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  const chip = (active: boolean) =>
    cn(
      'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] transition-colors',
      active ? 'border-accent bg-accent-soft/60 font-semibold text-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
    );
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by platform">
      <button className={chip(value === '')} onClick={() => onChange('')}>
        All <span className="tabular text-ink-3">{total}</span>
      </button>
      {PLATFORMS.filter((p) => (counts?.[p.key] ?? 0) > 0 || value === p.key).map((p) => (
        <button key={p.key} className={chip(value === p.key)} onClick={() => onChange(value === p.key ? '' : p.key)}>
          <PlatformDot platform={p.key} />
          {p.label} <span className="tabular text-ink-3">{counts?.[p.key] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
