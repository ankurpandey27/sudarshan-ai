// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ScrollText, Search } from 'lucide-react';
import { api } from '../lib/api';
import { clock, cn, levelColor, platformLabel, sourceLabel } from '../lib/format';
import type { ActivityPage } from '../lib/types';
import { Button, Card, Empty, Input, PageTitle } from '../components/ui';

type Kind = 'all' | 'apply' | 'problems';
const KINDS: { id: Kind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'apply', label: 'Applications' },
  { id: 'problems', label: 'Problems' },
];

const dayName = (day: string): string => {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

/** Everything the agent did in the last 7 days, searchable. */
export function ActivityPage() {
  const [day, setDay] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const query = useInfiniteQuery({
    queryKey: ['activity', day, kind, search],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ kind, limit: '150' });
      if (day) qs.set('day', day);
      if (search) qs.set('search', search);
      if (pageParam) qs.set('beforeId', String(pageParam));
      return api.get<ActivityPage>(`/events/history?${qs}`);
    },
    getNextPageParam: (last) => (last.hasMore ? last.items.at(-1)?.id : undefined),
  });
  const first = query.data?.pages[0];
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const days = first?.days ?? [];
  const total = days.reduce((n, d) => n + d.lines, 0);

  // Group lines under a date heading when showing several days.
  let lastDay = '';

  return (
    <>
      <PageTitle
        title="Flight log history"
        sub={`Everything Sudarshan did in the last ${first?.keepDays ?? 7} days - kept on this computer, older lines are cleared automatically.`}
      />

      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Day">
        <button onClick={() => setDay('')} className={chip(day === '')}>
          All {first?.keepDays ?? 7} days <span className="tabular text-ink-3">{total}</span>
        </button>
        {days.map((d) => (
          <button key={d.day} onClick={() => setDay(d.day)} className={chip(day === d.day)}>
            {dayName(d.day)} <span className="tabular text-ink-3">{d.lines}</span>
            {d.problems > 0 && <span className="rounded bg-warn-soft px-1 text-[11px] font-semibold text-warn tabular">{d.problems}</span>}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-line bg-surface p-0.5">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className={cn('rounded-md px-3 py-1 text-[13px]', kind === k.id ? 'bg-surface-2 font-semibold' : 'text-ink-3 hover:text-ink')}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-ink-3" />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search - a company, job title, error..." className="pl-8" />
        </div>
      </div>

      <Card className="overflow-hidden">
        {!query.isLoading && items.length === 0 && (
          <Empty icon={<ScrollText className="size-7" />} title={search || day || kind !== 'all' ? 'Nothing matches' : 'No activity yet'}>
            {search || day || kind !== 'all' ? 'Try another day, filter or search.' : 'Start the agent or press "Search now" on Lakshya.'}
          </Empty>
        )}
        <ol className="bg-surface-2/40 px-4 py-2 font-mono text-[12.5px] leading-6">
          {items.map((e) => {
            const d = new Date(e.at).toDateString();
            const heading = !day && d !== lastDay;
            lastDay = d;
            return (
              <li key={e.id}>
                {heading && (
                  <p className="sticky top-0 -mx-4 mt-2 mb-1 border-y border-line bg-surface px-4 py-1 font-sans text-[12px] font-semibold text-ink-2">
                    {dayName(new Date(e.at).toLocaleDateString('en-CA'))}
                  </p>
                )}
                <div className="flex gap-3">
                  <span className="shrink-0 text-ink-3 tabular">{clock(e.at)}</span>
                  {e.source && <span className="shrink-0 text-ink-3">{sourceLabel[e.source] ?? platformLabel(e.source)}</span>}
                  <span className={cn('min-w-0 break-words', levelColor[e.level], e.type === 'apply.step' && 'text-ink')}>{e.message}</span>
                </div>
              </li>
            );
          })}
        </ol>
        {query.hasNextPage && (
          <div className="border-t border-line p-3 text-center">
            <Button size="sm" onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>
              Load older
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}

function chip(active: boolean): string {
  return cn(
    'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] transition-colors',
    active ? 'border-accent bg-accent-soft/60 font-semibold text-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
  );
}
