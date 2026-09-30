// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, CheckCheck, Download, Link2, Play, RotateCcw, Search } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/format';
import { useJobs } from '../lib/queries';
import type { AppliedSyncResult, JobPlatform } from '../lib/types';
import { PlatformFilter } from '../components/platform-filter';
import { JobRow } from '../components/job-row';
import { Button, Card, Empty, Input, PageTitle, Textarea } from '../components/ui';
import { useToast } from '../components/toast';
import { InfoTip } from '../components/info-tip';
import { Pagination } from '../components/pagination';
import { useDebounced } from '../lib/use-debounced';
import { useSaved } from '../lib/use-saved';

const TABS = [
  { id: 'applied', label: 'Applied', status: 'applied' },
  {
    id: 'attention',
    label: 'Needs attention',
    status: 'needs_input,manual,failed',
  },
  { id: 'all', label: 'Everything', status: '' },
] as const;

export function Applications() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>(() => TABS.find((t) => t.id === params.get('tab'))?.id ?? 'applied');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useSaved('sudarshan.applications.pageSize', 20);
  const query = useDebounced(search.trim());
  const [platform, setPlatform] = useState<JobPlatform | ''>('');
  const [adding, setAdding] = useState(false);
  const current = TABS.find((t) => t.id === tab)!;
  const { data, isLoading } = useJobs({
    status: current.status,
    platform,
    search: query,
    sort: tab === 'applied' ? 'applied' : 'recent',
    page,
    limit: pageSize,
  });
  const qc = useQueryClient();
  const toast = useToast();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['jobs'] });
    void qc.invalidateQueries({ queryKey: ['stats'] });
  };
  const retry = useMutation({
    mutationFn: (id: number) => api.post('/jobs/approve', { ids: [id] }),
    onSuccess: () => {
      toast('ok', 'Back in the queue');
      refresh();
    },
  });
  const markApplied = useMutation({
    mutationFn: (id: number) => api.post(`/jobs/${id}/mark-applied`),
    onSuccess: () => {
      toast('ok', 'Counted as applied');
      refresh();
    },
  });
  // Tabs handed over to you that are still open: Sudarshan can carry on in them once you have unblocked them.
  const { data: openTabs } = useQuery({ queryKey: ['open-tabs'], queryFn: () => api.get<number[]>('/agent/open-tabs'), refetchInterval: 10_000 });
  const carryOn = useMutation({
    mutationFn: (id: number) => api.post<{ status: string; detail: string }>(`/agent/continue/${id}`),
    onSuccess: (r) => {
      toast(r.status === 'applied' ? 'ok' : r.status === 'busy' ? 'error' : 'ok', r.detail);
      refresh();
      void qc.invalidateQueries({ queryKey: ['open-tabs'] });
    },
    onError: (e: Error) => toast('error', e.message),
  });
  const openInBrowser = useMutation({
    mutationFn: (url: string) => api.post('/browser/open', { url }),
    onError: (e: Error) => toast('error', e.message),
  });
  // Applications you finished by hand on Indeed, which Sudarshan did not see go through.
  const syncIndeed = useMutation({
    mutationFn: () => api.post<AppliedSyncResult>('/applied-sync/indeed'),
    onSuccess: (r) => {
      toast(
        'ok',
        r.marked.length
          ? `Indeed lists ${r.listed} application(s): ${r.marked.length} marked Applied here (${r.marked
              .slice(0, 3)
              .map((m) => m.company)
              .join(', ')}${r.marked.length > 3 ? '...' : ''})`
          : `Indeed lists ${r.listed} application(s) - all already counted here`,
      );
      refresh();
    },
    onError: (e: Error) => toast('error', e.message),
  });

  return (
    <>
      <PageTitle
        title="Applications"
        sub="Every job the agent touched, with the full trace of what it did."
        actions={
          <>
            <Button icon={<CheckCheck className="size-4" />} onClick={() => syncIndeed.mutate()} loading={syncIndeed.isPending}>
              Check Indeed
            </Button>
            <InfoTip title="Check Indeed">
              Reads your Indeed "My jobs - Applied" list and marks those jobs Applied here - for applications you finished by hand in a tab Sudarshan left open.
              It matches by Indeed's own job id, only reads the page, and never clicks anything on Indeed. You need to be logged in to Indeed.
            </InfoTip>
            <Button icon={<Link2 className="size-4" />} onClick={() => setAdding((a) => !a)}>
              Add job links
            </Button>
            <a
              href="/api/workbook/export/file"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3.5 text-sm font-medium hover:bg-surface-2"
            >
              <Download className="size-4" /> Export to Excel
            </a>
          </>
        }
      />
      {adding && <AddLinks onDone={() => setAdding(false)} />}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  setPage(1);
                }}
                className={cn('rounded-md px-3 py-1 text-[13px]', tab === t.id ? 'bg-surface-2 font-semibold' : 'text-ink-3 hover:text-ink')}
              >
                {t.label}
              </button>
            ))}
          </div>
          <InfoTip title="Jobs that need attention" align="left">
            <b>Open in agent browser</b> opens the job in Sudarshan's own window, where you are already logged in, so you can finish it yourself.{' '}
            <b>I applied</b> marks it as applied once you have. <b>Retry</b> puts it back in the queue for Sudarshan to try again. Open a job's title to see
            every step Sudarshan took.
          </InfoTip>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-ink-3" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search title or company"
            className="pl-8"
          />
        </div>
      </div>
      <div className="mb-3">
        <PlatformFilter
          counts={data?.platforms}
          value={platform}
          onChange={(p) => {
            setPlatform(p);
            setPage(1);
          }}
        />
      </div>
      <Card>
        {!isLoading && !data?.items.length && (
          <Empty icon={<Briefcase className="size-7" />} title={tab === 'applied' ? 'No applications yet' : 'All clear'}>
            {tab === 'applied' ? 'Approve jobs in Review and start the agent.' : null}
          </Empty>
        )}
        <ul>
          {data?.items.map((j) => (
            <JobRow
              key={j.id}
              job={j}
              showStatus
              actions={
                ['manual', 'failed', 'needs_input'].includes(j.status) ? (
                  <>
                    {j.status === 'manual' && openTabs?.includes(j.id) && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<Play className="size-3.5" />}
                        loading={carryOn.isPending && carryOn.variables === j.id}
                        title="You solved the captcha or logged in: Sudarshan carries on from where its tab is"
                        onClick={() => carryOn.mutate(j.id)}
                      >
                        Continue
                      </Button>
                    )}
                    {j.status === 'manual' && !openTabs?.includes(j.id) && (
                      <Button size="sm" variant="ghost" onClick={() => openInBrowser.mutate(j.applyUrl || j.url)}>
                        Open in agent browser
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" icon={<CheckCheck className="size-3.5" />} onClick={() => markApplied.mutate(j.id)}>
                      I applied
                    </Button>
                    <Button size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => retry.mutate(j.id)}>
                      Retry
                    </Button>
                  </>
                ) : null
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
            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onPageSize={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          className="border-t border-line"
        />
      </Card>
    </>
  );
}

function AddLinks({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState('');
  const qc = useQueryClient();
  const toast = useToast();
  const add = useMutation({
    mutationFn: () =>
      api.post<{ added: number; duplicates: number; invalid: string[] }>('/jobs/links', {
        links: text
          .split(/\s+/)
          .filter((s) => /^(https?:\/\/|www\.)/i.test(s))
          .map((url) => ({ url })),
      }),
    onSuccess: (r) => {
      toast('ok', `${r.added} queued${r.duplicates ? `, ${r.duplicates} already known` : ''}${r.invalid.length ? `, ${r.invalid.length} not valid` : ''}`);
      void qc.invalidateQueries({ queryKey: ['jobs'] });
      onDone();
    },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <Card className="mb-4 p-4">
      <p className="mb-2 text-[13px] font-semibold">Paste job links - one per line, any site</p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={'https://www.linkedin.com/jobs/view/...\nhttps://www.instahyre.com/job-...\nhttps://jobs.lever.co/...'}
        className="font-mono text-[12.5px]"
      />
      <div className="mt-2 flex gap-2">
        <Button variant="primary" onClick={() => add.mutate()} loading={add.isPending} disabled={!/https?:\/\/|www\./.test(text)}>
          Queue them
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
