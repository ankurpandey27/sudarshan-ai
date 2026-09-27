// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ScrollText, Search } from 'lucide-react';
import { api } from '../lib/api';
import { clock, cn, levelColor, platformLabel, sourceLabel } from '../lib/format';
import type { ActivityPage } from '../lib/types';
import { Card, Empty, Input, PageTitle } from '../components/ui';
import { Pagination } from '../components/pagination';
import { useDebounced } from '../lib/use-debounced';
import { useSaved } from '../lib/use-saved';

type Kind = 'all' | 'apply' | 'problems';
const KINDS: { id: Kind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'apply', label: 'Applications' },
  { id: 'problems', label: 'Problems' },
];

// Log lines are tagged with the platform they are about; "web" is any other career site.
const SOURCES: { id: string; label: string }[] = [
  { id: '', label: 'All platforms' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'naukri', label: 'Naukri' },
  { id: 'indeed', label: 'Indeed' },
  { id: 'instahyre', label: 'Instahyre' },
  { id: 'web', label: 'Other sites' },
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
  const [source, setSource] = useState('');
  const [text, setText] = useState('');
  const search = useDebounced(text.trim());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useSaved('sudarshan.activity.pageSize', 50);
  useEffect(() => setPage(1), [day, kind, source, search, pageSize]);

  const query = useQuery({
    queryKey: ['activity', day, kind, source, search, page, pageSize],
    queryFn: () => {
      const qs = new URLSearchParams({ kind, limit: String(pageSize), page: String(page) });
      if (day) qs.set('day', day);
      if (source) qs.set('source', source);
      if (search) qs.set('search', search);
      return api.get<ActivityPage>(`/events/history?${qs}`);
    },
    placeholderData: keepPreviousData,
  });
  const first = query.data;
  const items = first?.items ?? [];
  const days = first?.days ?? [];
  const filtered = !!(search || day || source || kind !== 'all');
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
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label="Platform"
            className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px]"
          >
            {SOURCES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="relative flex-1 sm:w-72 sm:flex-none">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-ink-3" />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Search - a company, job title, error..."
              className="pl-8"
              aria-label="Search the log"
            />
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        {!query.isLoading && items.length === 0 && (
          <Empty icon={<ScrollText className="size-7" />} title={filtered ? 'Nothing matches' : 'No activity yet'}>
            {filtered ? 'Try another day, platform, filter or search.' : 'Start the agent or press "Search now" on Lakshya.'}
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
        <Pagination
          page={page}
          pageSize={pageSize}
          total={first?.total ?? 0}
          noun="lines"
          onPage={(p) => {
            setPage(p);
            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onPageSize={setPageSize}
          className="border-t border-line"
        />
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
