// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import type { ReactNode } from 'react';

export interface BarListItem {
  id: string;
  label: ReactNode;
  value: number;
  /** Shown instead of the value, e.g. "38%". */
  display?: string;
  hint?: string;
}

/** Ranked horizontal bars - labels read like a list, bars show the size. */
export function BarList({ items, color = 'var(--accent)', empty }: { items: BarListItem[]; color?: string; empty?: ReactNode }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="py-6 text-center text-[13px] text-ink-3">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.id} title={i.hint}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate first-letter:uppercase">{i.label}</span>
            <span className="shrink-0 font-semibold tabular">{i.display ?? i.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${(i.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
