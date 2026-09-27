// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { cn } from '../../lib/format';

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color: string;
  /** Second line in the legend, e.g. "12 found". */
  note?: string;
}

/** A ring with its total in the middle and a legend beside it. */
export function Donut({ slices, centerLabel, size = 132 }: { slices: DonutSlice[]; centerLabel: string; size?: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = slices.reduce((n, s) => n + s.value, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const shown = hover ? slices.find((s) => s.id === hover) : null;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="11" />
          {total > 0 &&
            slices
              .filter((s) => s.value > 0)
              .map((s) => {
                const len = (s.value / total) * c;
                // A hairline gap between slices.
                const el = (
                  <circle
                    key={s.id}
                    cx="50"
                    cy="50"
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={hover === s.id ? 13 : 11}
                    strokeDasharray={`${Math.max(0, len - 0.8)} ${c}`}
                    strokeDashoffset={-offset}
                    className="transition-[stroke-width,opacity] duration-200"
                    opacity={hover && hover !== s.id ? 0.45 : 1}
                    onMouseEnter={() => setHover(s.id)}
                    onMouseLeave={() => setHover(null)}
                  />
                );
                offset += len;
                return el;
              })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-[30px] leading-none tabular">{shown ? shown.value : total}</p>
            <p className="mt-1 text-[11px] text-ink-3">{shown ? shown.label : centerLabel}</p>
          </div>
        </div>
      </div>
      <ul className="min-w-36 flex-1 space-y-1.5 text-[13px]">
        {slices.map((s) => (
          <li
            key={s.id}
            className={cn('flex items-center justify-between gap-3 rounded-md px-1.5 py-0.5 transition-colors', hover === s.id && 'bg-surface-2')}
            onMouseEnter={() => setHover(s.id)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="shrink-0 text-right tabular">
              <span className="font-semibold">{s.value}</span>
              {s.note && <span className="ml-1.5 text-[11.5px] text-ink-3">{s.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
