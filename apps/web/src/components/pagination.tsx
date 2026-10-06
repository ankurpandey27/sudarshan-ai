// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/format';

export const PAGE_SIZES = [20, 50, 100] as const;

/** Page numbers with gaps: 1 … 4 5 6 … 12 */
function pages(current: number, count: number): (number | 'gap')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | 'gap')[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(count - 1, current + 1);
  if (from > 2) out.push('gap');
  for (let page = from; page <= to; page++) out.push(page);
  if (to < count - 1) out.push('gap');
  out.push(count);
  return out;
}

/** "21-40 of 190", page buttons and a page-size choice. Hidden when everything fits on one page. */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  noun = 'items',
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize?: (n: number) => void;
  noun?: string;
  className?: string;
}) {
  const count = Math.max(1, Math.ceil(total / pageSize));
  if (total <= PAGE_SIZES[0]) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] tabular transition-colors disabled:opacity-40';
  return (
    <nav aria-label="Pages" className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[12.5px] text-ink-3', className)}>
      <span className="tabular">
        {first}-{last} of {total} {noun}
      </span>
      <div className="flex items-center gap-1">
        <button className={cn(btn, 'hover:bg-surface-2')} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </button>
        {pages(page, count).map((p, i) =>
          p === 'gap' ? (
            <span key={`g${i}`} className="px-1">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(btn, p === page ? 'bg-ink font-semibold text-bg' : 'text-ink-2 hover:bg-surface-2')}
            >
              {p}
            </button>
          ),
        )}
        <button className={cn(btn, 'hover:bg-surface-2')} onClick={() => onPage(page + 1)} disabled={page >= count} aria-label="Next page">
          <ChevronRight className="size-4" />
        </button>
      </div>
      {onPageSize && (
        <label className="flex items-center gap-1.5">
          Per page
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-8 rounded-md border border-line bg-surface px-1.5 text-[12.5px] text-ink"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
    </nav>
  );
}
