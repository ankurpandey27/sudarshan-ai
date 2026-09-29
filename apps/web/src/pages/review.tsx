// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Inbox, Rocket, Search, SkipForward, Undo2, X } from 'lucide-react';
import { api } from '../lib/api';
import { cn, platformLabel } from '../lib/format';
import { useAgent, useJobs, useSettings, useStats, useTaste } from '../lib/queries';
import { useDebounced } from '../lib/use-debounced';
import { useSaved } from '../lib/use-saved';
import type { JobPlatform } from '../lib/types';
import { PlatformFilter } from '../components/platform-filter';
import { JobRow } from '../components/job-row';
import { Pagination } from '../components/pagination';
import { useTab, type TabDef } from '../components/tabs';
import { Button, Card, Empty, Input, PageTitle } from '../components/ui';
import { useToast } from '../components/toast';
import { InfoTip } from '../components/info-tip';

type Action = 'approve' | 'unqueue' | 'skip' | 'dismiss';

const DONE: Record<Action, (n: number) => string> = {
  approve: (n) => `${n} job(s) queued - the agent applies when it is running`,
  unqueue: (n) => `${n} job(s) moved back to review`,
  skip: (n) => `${n} job(s) skipped`,
  dismiss: (n) => `${n} job(s) dismissed`,
};

type TabId = 'review' | 'queued' | 'skipped';
const TABS: readonly TabDef<TabId>[] = [
  { id: 'review', label: 'To review' },
  { id: 'queued', label: 'Approved (queue)' },
  { id: 'skipped', label: 'Skipped' },
];
const STATUS: Record<TabId, string> = { review: 'review', queued: 'approved', skipped: 'skipped' };

export function Review() {
  const [tab, setTab] = useTab(TABS);
  const [platform, setPlatform] = useState<JobPlatform | ''>('');
  const [sort, setSort] = useState<'score' | 'taste'>('score');
  const [text, setText] = useState('');
  const search = useDebounced(text.trim());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useSaved('sudarshan.review.pageSize', 20);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Any change of what is shown starts again from page 1 with nothing ticked.
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [tab, platform, sort, search, pageSize]);

  const { data: taste } = useTaste();
  const { data: agent } = useAgent();
  // Platforms the agent is holding back right now (daily limit, paused, logged out): their queued jobs wait, the rest go on.
  const held = new Map((agent?.running ? agent.blockedSources : []).map((b) => [b.source, b.reason]));
  const { data: stats } = useStats();
  const { data: settings } = useSettings();
  const threshold = settings?.agent.minApplyScore ?? 70;
  const { data, isLoading, isFetching } = useJobs({ status: STATUS[tab], platform, sort, search, page, limit: pageSize });
  // Strong matches across every page, not just this one.
  const { data: strong } = useJobs({ status: 'review', platform, minScore: threshold, limit: 1 });
  const strongCount = strong?.total ?? 0;
  const qc = useQueryClient();
  const toast = useToast();
  const jobs = data?.items ?? [];

  const done = (msg: string) => {
    setSelected(new Set());
    void qc.invalidateQueries({ queryKey: ['jobs'] });
    void qc.invalidateQueries({ queryKey: ['stats'] });
    toast('ok', msg);
  };
  const act = useMutation({
    mutationFn: ({ ids, action }: { ids: number[]; action: Action }) => api.post<{ updated: number }>(`/jobs/${action}`, { ids }),
    onSuccess: (r, v) => done(DONE[v.action](r.updated)),
    onError: (e: Error) => toast('error', e.message),
  });
  const approveStrong = useMutation({
    mutationFn: () => api.post<{ updated: number }>('/jobs/approve-strong', { minScore: threshold, ...(platform ? { platform } : {}) }),
    onSuccess: (r) => done(DONE.approve(r.updated)),
    onError: (e: Error) => toast('error', e.message),
  });
  const applyNow = useMutation({
    mutationFn: (id: number) => api.post<{ status: string; detail: string }>(`/agent/apply/${id}`),
    onSuccess: (r) => toast(r.status === 'applied' ? 'ok' : 'error', r.detail),
    onError: (e: Error) => toast('error', e.message),
  });

  const toggle = (id: number, v: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });
  const allOnPage = jobs.length > 0 && jobs.every((j) => selected.has(j.id));
  const counts: Record<TabId, number | undefined> = { review: stats?.byStatus.review, queued: stats?.byStatus.approved, skipped: stats?.byStatus.skipped };

  return (
    <>
      <PageTitle
        title="Review"
        sub="The agent found and scored these. Approve a batch and it applies to them one by one."
        actions={
          tab === 'review' && strongCount > 0 ? (
            <Button variant="primary" icon={<Rocket className="size-4" />} onClick={() => approveStrong.mutate()} loading={approveStrong.isPending}>
              Approve {strongCount === 1 ? 'the 1 job' : `all ${strongCount}`} scoring {threshold}+
            </Button>
          ) : undefined
        }
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <div role="tablist" className="flex rounded-lg border border-line bg-surface p-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1 text-[13px]',
                  tab === t.id ? 'bg-surface-2 font-semibold' : 'text-ink-3 hover:text-ink',
                )}
              >
                {t.label}
                {counts[t.id] !== undefined && <span className="text-[11.5px] text-ink-3 tabular">{counts[t.id]}</span>}
              </button>
            ))}
          </div>
          <InfoTip title="Moving jobs around" align="left">
            <b>Approve</b> puts a job in the queue (the Approved tab); Sudarshan applies to queued jobs one by one while the agent is running.{' '}
            <b>Move to review</b> takes a job out of the queue and back to To review. <b>Skip</b> puts it in Skipped - you can still approve it later.{' '}
            <b>Dismiss</b> hides it for good. <b>Apply now</b> applies to one queued job straight away, even if its platform is switched off. Tick jobs to move
            several at once.
          </InfoTip>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-ink-3" />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search title or company" className="pl-8" aria-label="Search jobs" />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <PlatformFilter counts={data?.platforms} value={platform} onChange={setPlatform} />
        {taste?.status === 'ready' && (
          <div className="flex items-center gap-2 text-[12.5px] text-ink-3">
            Sort
            <div className="flex rounded-lg border border-line bg-surface p-0.5" role="radiogroup" aria-label="Sort">
              {(
                [
                  ['score', 'Best match'],
                  ['taste', 'Your interest'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={sort === id}
                  onClick={() => setSort(id)}
                  className={cn('rounded-md px-2.5 py-1', sort === id ? 'bg-surface-2 font-semibold text-ink' : 'hover:text-ink')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {tab === 'queued' && held.size > 0 && (
        <div className="mb-3 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-[13px] text-ink-2" role="status">
          <p className="font-semibold text-ink">Some queued jobs are waiting - the rest are being applied to</p>
          <ul className="mt-1 space-y-0.5">
            {[...held].map(([source, reason]) => (
              <li key={source}>
                <b>{platformLabel(source)}:</b> {reason}
                {/limit/i.test(reason) ? ' - its jobs stay queued and go out tomorrow' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card className={cn('overflow-hidden transition-opacity', isFetching && !isLoading && 'opacity-70')}>
        {jobs.length > 0 && (
          // Bulk actions live in the list header, right where you ticked.
          <div
            className={cn(
              'flex min-h-11 flex-wrap items-center gap-2 border-b border-line px-4 py-1.5 text-[12.5px]',
              selected.size > 0 && 'bg-accent-soft/40',
            )}
          >
            <label className="flex items-center gap-2 text-ink-3">
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                checked={allOnPage}
                onChange={(e) => setSelected(e.target.checked ? new Set(jobs.map((j) => j.id)) : new Set())}
                aria-label="Select all on this page"
              />
              {selected.size > 0 ? <span className="font-semibold text-ink">{selected.size} selected</span> : 'Select all on this page'}
            </label>
            {selected.size > 0 && (
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {tab !== 'queued' && (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Check className="size-3.5" />}
                    onClick={() => act.mutate({ ids: [...selected], action: 'approve' })}
                  >
                    Approve
                  </Button>
                )}
                {tab !== 'review' && (
                  <Button size="sm" icon={<Undo2 className="size-3.5" />} onClick={() => act.mutate({ ids: [...selected], action: 'unqueue' })}>
                    Move to review
                  </Button>
                )}
                {tab !== 'skipped' && (
                  <Button size="sm" icon={<SkipForward className="size-3.5" />} onClick={() => act.mutate({ ids: [...selected], action: 'skip' })}>
                    Skip
                  </Button>
                )}
                <Button size="sm" variant="danger" icon={<X className="size-3.5" />} onClick={() => act.mutate({ ids: [...selected], action: 'dismiss' })}>
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        )}
        {isLoading && (
          <div className="space-y-3 p-4" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-2/70" />
            ))}
          </div>
        )}
        {!isLoading && jobs.length === 0 && (
          <Empty
            icon={<Inbox className="size-7" />}
            title={search || platform ? 'Nothing matches' : tab === 'review' ? 'Nothing to review' : tab === 'queued' ? 'Queue is empty' : 'Nothing skipped'}
          >
            {search || platform
              ? 'Try another search or platform.'
              : tab === 'review'
                ? 'Press "Search now" on Lakshya, or start the agent - scored jobs land here.'
                : null}
          </Empty>
        )}
        <ul>
          {jobs.map((j) => (
            <JobRow
              key={j.id}
              job={j}
              selected={selected.has(j.id)}
              onSelect={(v) => toggle(j.id, v)}
              actions={
                tab === 'queued' ? (
                  <>
                    {held.has(j.platform) && (
                      <span className="rounded-md bg-warn-soft px-2 py-1 text-[11.5px] font-medium text-warn" title={held.get(j.platform)}>
                        {/limit/i.test(held.get(j.platform) ?? '') ? 'Waiting - daily limit' : 'Waiting'}
                      </span>
                    )}
                    <Button size="sm" variant="ghost" icon={<Undo2 className="size-3.5" />} onClick={() => act.mutate({ ids: [j.id], action: 'unqueue' })}>
                      Move to review
                    </Button>
                    <Button size="sm" onClick={() => applyNow.mutate(j.id)} loading={applyNow.isPending && applyNow.variables === j.id}>
                      Apply now
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => act.mutate({ ids: [j.id], action: 'approve' })} icon={<Check className="size-3.5" />}>
                    Approve
                  </Button>
                )
              }
            />
          ))}
        </ul>
        <Pagination
          page={page}
          pageSize={pageSize}
          total={data?.total ?? 0}
          noun="jobs"
          onPage={(p) => {
            setPage(p);
            setSelected(new Set());
            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onPageSize={setPageSize}
          className="border-t border-line"
        />
      </Card>
    </>
  );
}
