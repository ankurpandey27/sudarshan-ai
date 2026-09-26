import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { ArrowUpRight, Radar, Sparkles } from 'lucide-react';
import { InsightsPanel } from '../components/insights-panel';
import { api } from '../lib/api';
import { clock, cn, sourceLabel, timeAgo, timeUntil } from '../lib/format';
import { useEvents } from '../lib/events';
import { useAgent, useSettings, useStats, useUsage } from '../lib/queries';
import type { AgentEvent } from '../lib/types';
import { Badge, Button, Card, CardHeader, PageTitle } from '../components/ui';
import { useToast } from '../components/toast';

type Filter = 'all' | 'apply' | 'problems';

export function Dashboard() {
  const { data: agent } = useAgent();
  const { data: stats } = useStats();
  const { data: settings } = useSettings();
  const { data: usage } = useUsage();
  const toast = useToast();
  const discover = useMutation({
    mutationFn: () => api.post('/agent/discover'),
    onSuccess: () => toast('ok', 'Searching now - new jobs appear in Review as they are scored'),
    onError: (e: Error) => toast('error', e.message),
  });

  const limits = settings?.sources;
  const tokens = (usage?.promptTokens ?? 0) + (usage?.completionTokens ?? 0);
  const freeFill = stats?.memoryHitRate;

  return (
    <>
      <PageTitle
        title="Mission control"
        sub={
          agent?.llm ? (
            <>
              Thinking with <b className="text-ink-2">{agent.llm}</b> - {settings?.agent.mode === 'auto' ? 'applies on its own' : 'you approve every batch'}
            </>
          ) : (
            <>No AI model set - running on profile and memory only. <Link className="text-info hover:underline" to="/settings">Add one</Link></>
          )
        }
        actions={
          <Button onClick={() => discover.mutate()} loading={discover.isPending} icon={<Radar className="size-4" />}>
            Search now
          </Button>
        }
      />

      <InsightsPanel />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Applied today" value={stats?.appliedToday ?? 0}>
          <div className="mt-2 flex flex-wrap gap-1">
            {(['linkedin', 'naukri', 'web'] as const).map((s) => {
              const limit = s === 'web' ? limits?.links.dailyLimit : limits?.[s].dailyLimit;
              return (
                <Badge key={s}>
                  {sourceLabel[s]} {stats?.appliedTodayBySource[s] ?? 0}/{limit ?? '-'}
                </Badge>
              );
            })}
          </div>
        </Stat>
        <Stat label="In the queue" value={agent?.queue ?? 0} foot={<Link to="/review" className="hover:text-ink">{stats?.byStatus.review ?? 0} waiting for your review <ArrowUpRight className="inline size-3" /></Link>} />
        <Stat
          label="Needs you"
          value={agent?.openQuestions ?? 0}
          tone={agent?.openQuestions ? 'warn' : undefined}
          foot={<Link to="/questions" className="hover:text-ink">Answer once, unblock every job <ArrowUpRight className="inline size-3" /></Link>}
        />
        <Stat label="Filled without AI" value={freeFill === null || freeFill === undefined ? '-' : `${Math.round(freeFill * 100)}%`}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-good transition-[width] duration-700" style={{ width: `${Math.round((freeFill ?? 0) * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-[12px] text-ink-3">
            {stats?.medianApplySeconds ? `~${stats.medianApplySeconds}s per application` : 'Grows as answer memory learns'}
          </p>
        </Stat>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
        <FlightLog />
        <div className="space-y-4">
          <Card>
            <CardHeader title="Next up" />
            <dl className="divide-y divide-line text-[13px]">
              <Row k="State" v={agent?.running ? agent.phase : 'stopped'} />
              <Row k="Next application" v={agent?.running ? timeUntil(agent.nextApplyAt) : '-'} />
              <Row k="Next search" v={agent?.running ? timeUntil(agent.nextDiscoveryAt) : '-'} />
              <Row k="Last search" v={timeAgo(agent?.lastDiscoveryAt)} />
            </dl>
          </Card>
          <Card>
            <CardHeader title="AI today" hint="Only what memory could not answer" />
            <div className="px-4 py-3">
              <p className="font-display text-3xl tabular">
                {tokens.toLocaleString()} <span className="font-sans text-[13px] text-ink-3">tokens</span>
              </p>
              {!!usage?.budget && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (tokens / usage.budget) * 100)}%` }} />
                </div>
              )}
              <ul className="mt-3 space-y-1 text-[12.5px] text-ink-2">
                {(usage?.byPurpose ?? []).map((p) => (
                  <li key={p.purpose} className="flex justify-between">
                    <span>{p.purpose.replace('_', ' ')}</span>
                    <span className="tabular text-ink-3">
                      {p.calls} calls - {p.tokens.toLocaleString()}
                    </span>
                  </li>
                ))}
                {!usage?.byPurpose.length && <li className="text-ink-3">No AI calls yet today.</li>}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, children, foot, tone }: { label: string; value: number | string; children?: React.ReactNode; foot?: React.ReactNode; tone?: 'warn' }) {
  return (
    <Card className={cn('px-4 py-3.5', tone === 'warn' && 'border-warn/40')}>
      <p className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">{label}</p>
      <p className={cn('mt-1 font-display text-[42px] leading-none tabular', tone === 'warn' && 'text-warn')}>{value}</p>
      {children}
      {foot && <p className="mt-2 text-[12px] text-ink-3">{foot}</p>}
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between px-4 py-2">
      <dt className="text-ink-3">{k}</dt>
      <dd className="font-medium capitalize">{v}</dd>
    </div>
  );
}

const levelColor: Record<AgentEvent['level'], string> = {
  info: 'text-ink-2',
  success: 'text-good',
  warn: 'text-warn',
  error: 'text-bad',
};

function FlightLog() {
  const { events, connected } = useEvents();
  const [filter, setFilter] = useState<Filter>('all');
  const shown = useMemo(
    () =>
      events
        .filter((e) => e.type === 'log' || e.type === 'apply.step' || e.type === 'question.pending')
        .filter((e) => (filter === 'apply' ? e.type === 'apply.step' || !!e.jobId : filter === 'problems' ? e.level === 'warn' || e.level === 'error' : true))
        .slice(0, 150),
    [events, filter],
  );
  return (
    <Card className="flex min-h-[420px] flex-col overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-accent" /> Flight log
          </span>
        }
        hint={connected ? 'Live from the agent' : 'Reconnecting...'}
        action={
          <div className="flex rounded-lg border border-line p-0.5 text-[12px]">
            {(['all', 'apply', 'problems'] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn('rounded-md px-2 py-0.5 capitalize', filter === f ? 'bg-surface-2 font-semibold text-ink' : 'text-ink-3')}>
                {f}
              </button>
            ))}
          </div>
        }
      />
      <ol className="flex-1 overflow-y-auto bg-surface-2/40 px-4 py-2 font-mono text-[12.5px] leading-6" style={{ maxHeight: 520 }}>
        {shown.length === 0 && <li className="py-10 text-center font-sans text-ink-3">Nothing yet. Start the agent or press "Search now".</li>}
        {shown.map((e) => (
          <li key={e.id} className="log-line flex gap-3">
            <span className="shrink-0 text-ink-3 tabular">{clock(e.at)}</span>
            {e.source && <span className="shrink-0 text-ink-3">{sourceLabel[e.source] ?? e.source}</span>}
            <span className={cn('min-w-0 break-words', levelColor[e.level], e.type === 'apply.step' && 'text-ink')}>{e.message}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
