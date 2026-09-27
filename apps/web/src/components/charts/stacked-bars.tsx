// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState, type ReactNode } from 'react';
import { cn } from '../../lib/format';
import { niceMax } from '../../lib/chart';

export interface BarSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface BarColumn {
  key: string;
  /** Axis label; shown for some columns only when there are many. */
  label: string;
  /** Tooltip heading. */
  title: string;
  segments: BarSegment[];
}

/** Columns of stacked bars with a light grid and a hover card. */
export function StackedBars({
  columns,
  height = 200,
  empty,
  marker,
  unit = 'jobs',
}: {
  columns: BarColumn[];
  height?: number;
  empty?: ReactNode;
  /** A dashed vertical line before column `index`, e.g. the apply score. */
  marker?: { index: number; label: string };
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = columns.map((c) => c.segments.reduce((n, s) => n + s.value, 0));
  const max = niceMax(Math.max(0, ...totals));
  // About six evenly spaced labels, so they never collide on a narrow screen.
  const every = Math.max(1, Math.ceil(columns.length / 6));
  const labelled = (i: number) => i % every === 0;
  const nothing = totals.every((t) => t === 0);

  return (
    <div className="relative select-none" onMouseLeave={() => setHover(null)}>
      <div className="relative flex" style={{ height }}>
        {/* Grid: top, middle, baseline. */}
        {[1, 0.5, 0].map((f) => (
          <div key={f} className="pointer-events-none absolute inset-x-0 flex items-center" style={{ bottom: `${f * 100}%` }}>
            <span className="w-7 shrink-0 pr-2 text-right text-[10.5px] text-ink-3 tabular -translate-y-0">{Math.round(max * f)}</span>
            <span className={cn('h-px flex-1', f === 0 ? 'bg-line' : 'bg-[var(--grid)]')} />
          </div>
        ))}
        <div className="relative ml-7 flex flex-1 items-end gap-[3px] sm:gap-1.5">
          {columns.map((c, i) => (
            <div
              key={c.key}
              className="group relative flex h-full flex-1 cursor-default flex-col justify-end"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={0}
              aria-label={`${c.title}: ${totals[i]} ${unit}`}
            >
              {marker?.index === i && (
                <span className="pointer-events-none absolute inset-y-0 -left-[3px] border-l border-dashed border-ink-3/60 sm:-left-1">
                  <span className="absolute -top-1 left-1 text-[10.5px] whitespace-nowrap text-ink-3">{marker.label}</span>
                </span>
              )}
              <div
                className={cn(
                  'flex w-full flex-col-reverse overflow-hidden rounded-t-[5px] transition-[height,opacity] duration-500 ease-out',
                  hover !== null && hover !== i && 'opacity-55',
                )}
                style={{ height: `${(totals[i] / max) * 100}%` }}
              >
                {c.segments
                  .filter((s) => s.value > 0)
                  .map((s) => (
                    <div key={s.id} style={{ height: `${(s.value / totals[i]) * 100}%`, background: s.color }} className="w-full" />
                  ))}
              </div>
            </div>
          ))}
        </div>
        {nothing && empty && <div className="absolute inset-0 ml-7 grid place-items-center text-[13px] text-ink-3">{empty}</div>}
      </div>
      <div className="relative mt-1.5 ml-7 h-4">
        {columns.map((c, i) =>
          labelled(i) ? (
            <span
              key={c.key}
              className="absolute -translate-x-1/2 text-[10.5px] whitespace-nowrap text-ink-3 tabular"
              style={{ left: `${((i + 0.5) / columns.length) * 100}%` }}
            >
              {c.label}
            </span>
          ) : null,
        )}
      </div>
      {hover !== null && totals.length > 0 && (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] shadow-card"
          style={{ left: `calc(1.75rem + (100% - 1.75rem) * ${(hover + 0.5) / columns.length})` }}
        >
          <p className="font-semibold">{columns[hover].title}</p>
          <p className="text-ink-3 tabular">
            {totals[hover]} {unit}
          </p>
          {columns[hover].segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <p key={s.id} className="mt-0.5 flex items-center justify-between gap-3 tabular">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </span>
                {s.value}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
