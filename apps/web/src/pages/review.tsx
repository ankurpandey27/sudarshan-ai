// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Inbox, Rocket, SkipForward, Undo2, X } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/format';
import { useJobs, useSettings, useTaste } from '../lib/queries';
import type { JobPlatform } from '../lib/types';
import { PlatformFilter } from '../components/platform-filter';
import { JobRow } from '../components/job-row';
import { Button, Card, Empty, PageTitle } from '../components/ui';
import { useToast } from '../components/toast';
import { InfoTip } from '../components/info-tip';

type Action = 'approve' | 'unqueue' | 'skip' | 'dismiss';

const DONE: Record<Action, (n: number) => string> = {
  approve: (n) => `${n} job(s) queued - the agent applies when it is running`,
  unqueue: (n) => `${n} job(s) moved back to review`,
  skip: (n) => `${n} job(s) skipped`,
  dismiss: (n) => `${n} job(s) dismissed`,
};

const TABS = [
  { id: 'review', label: 'To review', status: 'review' },
  { id: 'queued', label: 'Approved (queue)', status: 'approved' },
  { id: 'skipped', label: 'Skipped', status: 'skipped' },
] as const;

export function Review() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>(() => TABS.find((t) => t.id === params.get('tab'))?.id ?? 'review');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [platform, setPlatform] = useState<JobPlatform | ''>('');
  const [sort, setSort] = useState<'score' | 'taste'>('score');
  const { data: taste } = useTaste();
  const current = TABS.find((t) => t.id === tab)!;
  const { data, isLoading } = useJobs({
    status: current.status,
    platform,
    sort,
    limit: 100,
  });
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const toast = useToast();
  const jobs = data?.items ?? [];
  const threshold = settings?.agent.minApplyScore ?? 70;

  const act = useMutation({
    mutationFn: ({ ids, action }: { ids: number[]; action: Action }) => api.post<{ updated: number }>(`/jobs/${action}`, { ids }),
    onSuccess: (r, v) => {
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ['jobs'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
      toast('ok', DONE[v.action](r.updated));
    },
    onError: (e: Error) => toast('error', e.message),
  });
  const applyNow = useMutation({
    mutationFn: (id: number) => api.post<{ status: string; detail: string }>(`/agent/apply/${id}`),
    onSuccess: (r) => toast(r.status === 'applied' ? 'ok' : 'error', r.detail),
    onError: (e: Error) => toast('error', e.message),
  });

  const strong = jobs.filter((j) => (j.score ?? 0) >= threshold).map((j) => j.id);
  const toggle = (id: number, v: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <>
      <PageTitle
        title="Review"
        sub="The agent found and scored these. Approve a batch and it applies to them one by one."
        actions={
          tab === 'review' && strong.length > 0 ? (
            <Button
              variant="primary"
              icon={<Rocket className="size-4" />}
              onClick={() => act.mutate({ ids: strong, action: 'approve' })}
              loading={act.isPending}
            >
              Approve {strong.length === 1 ? 'the 1 job' : `all ${strong.length} jobs`} scoring {threshold}+
            </Button>
          ) : undefined
        }
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  setSelected(new Set());
                }}
                className={cn('rounded-md px-3 py-1 text-[13px]', tab === t.id ? 'bg-surface-2 font-semibold' : 'text-ink-3 hover:text-ink')}
              >
                {t.label}
              </button>
            ))}
          </div>
          <InfoTip title="Moving jobs around" align="left">
            <b>Approve</b> puts a job in the queue (the Approved tab); Sudarshan applies to queued jobs one by one while the agent is running.{' '}
            <b>Move to review</b> takes a job out of the queue and back to To review. <b>Skip</b> puts it in Skipped - you can still approve it later.{' '}
            <b>Dismiss</b> hides it for good. <b>Apply now</b> applies to one queued job straight away, even if its platform is switched off. Tick jobs (or
            Select all) to move many at once, and use the platform chips to see only LinkedIn, Naukri or Instahyre jobs.
          </InfoTip>
        </div>
        {taste?.status === 'ready' && (
          <div className="flex rounded-lg border border-line bg-surface p-0.5 text-[12.5px]" role="radiogroup" aria-label="Sort">
            {(
              [
                ['score', 'Best match'],
                ['taste', 'Your taste'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="radio"
                aria-checked={sort === id}
                onClick={() => setSort(id)}
                className={cn('rounded-md px-2.5 py-1', sort === id ? 'bg-surface-2 font-semibold' : 'text-ink-3 hover:text-ink')}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <PlatformFilter
          counts={data?.platforms}
          value={platform}
          onChange={(p) => {
            setPlatform(p);
            setSelected(new Set());
          }}
        />
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-ink-3">{selected.size} selected</span>
            {tab !== 'queued' && (
              <Button size="sm" variant="primary" icon={<Check className="size-3.5" />} onClick={() => act.mutate({ ids: [...selected], action: 'approve' })}>
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
      <Card>
        {jobs.length > 0 && (
          <label className="flex items-center gap-2 border-b border-line px-4 py-2 text-[12.5px] text-ink-3">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent)]"
              checked={selected.size === jobs.length}
              onChange={(e) => setSelected(e.target.checked ? new Set(jobs.map((j) => j.id)) : new Set())}
            />
            Select all {data?.total && data.total > jobs.length ? `(showing ${jobs.length} of ${data.total})` : ''}
          </label>
        )}
        {!isLoading && jobs.length === 0 && (
          <Empty icon={<Inbox className="size-7" />} title={tab === 'review' ? 'Nothing to review' : tab === 'queued' ? 'Queue is empty' : 'Nothing skipped'}>
            {tab === 'review' ? 'Press "Search now" on Lakshya, or start the agent - scored jobs land here.' : null}
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
      </Card>
    </>
  );
}
