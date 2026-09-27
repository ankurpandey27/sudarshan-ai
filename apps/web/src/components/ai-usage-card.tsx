// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { cn, tokensShort } from '../lib/format';
import type { LlmUsage } from '../lib/types';
import { Card, CardHeader } from './ui';

const label = (purpose: string) => purpose.replace(/_/g, ' ');

export function AiUsageCard({ usage }: { usage: LlmUsage | undefined }) {
  const [view, setView] = useState<'purpose' | 'model'>('purpose');
  const today = usage?.today.tokens ?? 0;
  const periods = [
    { k: 'Today', p: usage?.today },
    { k: 'This month', p: usage?.month },
    { k: 'All time', p: usage?.allTime },
  ];
  const rows =
    (view === 'purpose' ? usage?.byPurposeAllTime.map((r) => ({ name: label(r.purpose), ...r })) : usage?.byModel.map((r) => ({ name: r.model, ...r }))) ?? [];
  const since = usage?.allTime.since ? new Date(usage.allTime.since).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  return (
    <Card>
      <CardHeader title="AI usage" hint="Only what memory could not answer. Kept forever." />
      <div className="grid grid-cols-3 border-b border-line">
        {periods.map(({ k, p }, i) => (
          <div key={k} className={cn('px-3 py-3', i > 0 && 'border-l border-line')}>
            <p className="text-[12px] text-ink-3">{k}</p>
            <p className="mt-0.5 font-display text-[26px] leading-none tabular" title={`${(p?.tokens ?? 0).toLocaleString()} tokens`}>
              {tokensShort(p?.tokens ?? 0)}
            </p>
            <p className="mt-1 text-[11.5px] text-ink-3 tabular">
              {(p?.calls ?? 0).toLocaleString()} call{p?.calls === 1 ? '' : 's'}
              {p?.failedCalls ? ` · ${p.failedCalls} failed` : ''}
            </p>
          </div>
        ))}
      </div>
      <div className="px-4 py-3">
        {!!usage?.budget && (
          <div className="mb-3">
            <div className="flex justify-between text-[11.5px] text-ink-3">
              <span>Today's budget</span>
              <span className="tabular">
                {today.toLocaleString()} / {usage.budget.toLocaleString()}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (today / usage.budget) * 100)}%` }} />
            </div>
          </div>
        )}
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[12px] font-semibold text-ink-2">All time by</p>
          <div className="flex rounded-md border border-line p-0.5 text-[11.5px]">
            {(['purpose', 'model'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn('rounded px-2 py-0.5', view === v ? 'bg-surface-2 font-semibold text-ink' : 'text-ink-3 hover:text-ink')}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <ul className="space-y-1 text-[12.5px] text-ink-2">
          {rows.map((r) => (
            <li key={r.name} className="flex justify-between gap-3">
              <span className="truncate">{r.name}</span>
              <span className="shrink-0 tabular text-ink-3">
                {r.calls.toLocaleString()} call{r.calls === 1 ? '' : 's'} · {tokensShort(r.tokens)}
              </span>
            </li>
          ))}
          {!rows.length && <li className="text-ink-3">No AI calls yet.</li>}
        </ul>
        {since && <p className="mt-3 text-[11px] text-ink-3">Counting since {since}</p>}
      </div>
    </Card>
  );
}
