// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Radar } from 'lucide-react';
import { AttentionSummary } from '../components/attention-summary';
import { api } from '../lib/api';
import { clock, cn, levelColor, PLATFORMS, platformLabel, sourceLabel, timeAgo, timeUntil } from '../lib/format';
import { pct, shortDay, trend } from '../lib/chart';
import { useEvents } from '../lib/events';
import { useAgent, useAnalytics, useSettings, useStats, useUsage } from '../lib/queries';
import type { AnalyticsReport, JobPlatform } from '../lib/types';
import { AiUsageCard } from '../components/ai-usage-card';
import { TasteCard } from '../components/taste-card';
import { Tabs, useTab, type TabDef } from '../components/tabs';
import { ApplyOnCard } from '../components/apply-on-card';
import { MissionControl } from '../components/mission/mission-control';
import { TodayCard } from '../components/today-card';
import { PLATFORM_COLOR } from '../components/platform-badge';
import { Button, Card, CardHeader } from '../components/ui';
import { useToast } from '../components/toast';
import { InfoTip } from '../components/info-tip';
import { StackedBars, type BarColumn } from '../components/charts/stacked-bars';
import { Donut } from '../components/charts/donut';
import { Sparkline } from '../components/charts/sparkline';
import { BarList } from '../components/charts/bar-list';
import { Pipeline } from '../components/charts/pipeline';

type View = 'mission' | 'overview' | 'insights' | 'activity';
const VIEWS: readonly TabDef<View>[] = [
  { id: 'mission', label: 'Mission control' },
  { id: 'overview', label: 'Overview' },
  { id: 'insights', label: 'Insights' },
  { id: 'activity', label: 'Activity' },
];

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];
const RANGE_KEY = 'sudarshan.lakshya.range';

// A remembered view preference only; the page works without storage.
const savedRange = (): Range => {
  try {
    const days = Number(localStorage.getItem(RANGE_KEY));
    return (RANGES as readonly number[]).includes(days) ? (days as Range) : 30;
  } catch {
    return 30;
  }
};

export function Dashboard() {
  const { data: agent } = useAgent();
  const { data: stats } = useStats();
  const { data: settings } = useSettings();
  const { data: usage } = useUsage();
  const [view, setView] = useTab(VIEWS, 'view');
  // A link to a card ("/?view=overview#apply-on") scrolls to it once the view is on screen.
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const timer = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    return () => window.clearTimeout(timer);
  }, [hash, view]);
  const [days, setDays] = useState<Range>(savedRange);
  const [platform, setPlatform] = useState<JobPlatform | ''>('');
  const { data: report, isLoading } = useAnalytics(days, platform);
  const toast = useToast();
  const discover = useMutation({
    mutationFn: () => api.post('/agent/discover'),
    onSuccess: () => toast('ok', 'Searching now - new jobs appear in Review as they are scored'),
    onError: (e: Error) => toast('error', e.message),
  });

  const pickRange = (r: Range) => {
    setDays(r);
    try {
      localStorage.setItem(RANGE_KEY, String(r));
    } catch {
      // Not remembered - fine.
    }
  };

  const status = agent?.scoring
    ? [`scoring ${agent.scoring.done} of ${agent.scoring.total} jobs`]
    : agent?.running
      ? [
          agent.currentJob ? `applying to ${agent.currentJob.title}` : agent.phase,
          agent.nextApplyAt && `next application ${timeUntil(agent.nextApplyAt)}`,
          `next search ${timeUntil(agent.nextDiscoveryAt)}`,
        ]
      : ['resting', agent?.lastDiscoveryAt && `last search ${timeAgo(agent.lastDiscoveryAt)}`];

  return (
    <div className="mx-auto max-w-[1320px]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[32px] leading-[1.05]">Lakshya</h1>
          <p className="mt-2 text-[14px] text-ink-3">
            <span className="text-ink-2">Your job hunt, on target.</span>{' '}
            <span className={cn('inline-flex items-center gap-1.5', agent?.running && 'text-ink-2')}>
              <span className={cn('size-1.5 rounded-full', agent?.running ? 'live-dot bg-good' : 'bg-ink-3/60')} />
              {status.filter(Boolean).join(' · ')}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button onClick={() => discover.mutate()} loading={discover.isPending} icon={<Radar className="size-4" />}>
            Search now
          </Button>
          <InfoTip title="Search now">
            Looks for new jobs on every platform switched on under Apply on, using your job titles and locations, instead of waiting for the next scheduled
            search (every {settings?.agent.intervalMinutes ?? 60} minutes while the agent runs). New jobs are scored and appear in Review. It never applies to
            anything by itself.
          </InfoTip>
        </div>
      </header>

      <Tabs tabs={VIEWS} value={view} onChange={setView} />

      {view === 'mission' && <MissionControl />}

      {(view === 'overview' || view === 'insights') && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented label="Range" value={days} options={RANGES.map((r) => ({ value: r, label: `${r} days` }))} onChange={pickRange} />
          <Segmented
            label="Platform"
            value={platform}
            options={[{ value: '' as const, label: 'All platforms' }, ...PLATFORMS.map((p) => ({ value: p.key, label: p.label, dot: p.key }))]}
            onChange={setPlatform}
          />
        </div>
      )}

      {view === 'overview' && (
        <>
          <AttentionSummary />

          <Kpis report={report} days={days} queue={agent?.queue ?? 0} review={stats?.byStatus.review ?? 0} questions={agent?.openQuestions ?? 0} />

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <ApplicationsChart report={report} loading={isLoading} />
            <Card>
              <CardHeader title="Pipeline" hint={`Jobs found in the last ${days} days, and how far they got.`} />
              <div className="px-5 py-5">
                <Pipeline
                  stages={[
                    { id: 'found', label: 'Found', value: report?.pipeline.found ?? 0, hint: 'Jobs discovered in this range' },
                    { id: 'matched', label: 'Worth a look', value: report?.pipeline.matched ?? 0, hint: 'Scored high enough to review' },
                    { id: 'approved', label: 'Approved', value: report?.pipeline.approved ?? 0, hint: 'Approved by you, or by auto mode' },
                    { id: 'applied', label: 'Applied', value: report?.pipeline.applied ?? 0, hint: 'Application sent' },
                  ]}
                />
                {report && report.pipeline.approved > report.pipeline.applied && (
                  <p className="mt-5 rounded-xl bg-surface-2/70 px-3.5 py-2.5 text-[12.5px] text-ink-2">
                    {report.pipeline.approved - report.pipeline.applied} approved job(s) not sent yet - they are in the queue, or need you in{' '}
                    <Link to="/applications" className="text-info hover:underline">
                      Applications
                    </Link>
                    .
                  </p>
                )}
              </div>
            </Card>
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <TodayCard />
            <ApplyOnCard />
          </div>
        </>
      )}

      {view === 'insights' && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <MatchQuality report={report} minApply={settings?.agent.minApplyScore ?? 70} />
            <Card>
              <CardHeader title="Where your applications went" hint={`Every platform, last ${days} days.`} />
              <div className="px-5 py-5">
                <Donut
                  centerLabel="applied"
                  slices={(report?.byPlatform ?? []).map((p) => ({
                    id: p.platform,
                    label: platformLabel(p.platform),
                    value: p.applied,
                    color: PLATFORM_COLOR[p.platform],
                    note: `of ${p.found} found`,
                  }))}
                />
              </div>
            </Card>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Skills jobs asked for that you don't list"
                hint="Worth adding to your profile if you have them - or learning next."
                action={
                  <Link to="/profile" className="shrink-0 text-[12.5px] text-info hover:underline">
                    Edit profile
                  </Link>
                }
              />
              <div className="px-5 py-5">
                <BarList
                  color="var(--p-linkedin)"
                  empty="Nothing yet - appears once jobs are scored."
                  items={(report?.missingSkills ?? []).map((s) => ({ id: s.skill, label: s.skill, value: s.jobs, display: `${s.jobs} jobs` }))}
                />
              </div>
            </Card>
            <Card>
              <CardHeader
                title="Why jobs were skipped"
                hint="Each is a setting you can change."
                action={
                  <Link to="/review?tab=skipped" className="shrink-0 text-[12.5px] text-info hover:underline">
                    See skipped
                  </Link>
                }
              />
              <div className="px-5 py-5">
                <BarList
                  color="var(--p-other)"
                  empty="Nothing skipped in this range."
                  items={(report?.skipReasons ?? []).map((r) => ({ id: r.rule, label: r.label, value: r.jobs, hint: r.fix }))}
                />
                {report?.skipReasons[0]?.fix && (
                  <p className="mt-5 rounded-xl bg-surface-2/70 px-3.5 py-2.5 text-[12.5px] text-ink-2">
                    <span className="font-semibold text-ink">To skip fewer for "{report.skipReasons[0].label}": </span>
                    {report.skipReasons[0].fix}
                  </p>
                )}
              </div>
            </Card>
          </div>
          <div className="mt-5">
            <TasteCard />
          </div>
        </>
      )}

      {view === 'activity' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <RecentActivity />
          <AiUsageCard usage={usage} />
        </div>
      )}
    </div>
  );
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; dot?: JobPlatform }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex max-w-full overflow-x-auto rounded-full border border-line/80 bg-surface/80 p-1 shadow-card">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[13px] whitespace-nowrap transition-colors duration-200',
            value === o.value ? 'bg-ink text-bg' : 'text-ink-3 hover:text-ink',
          )}
        >
          {o.dot && <span className="size-2 rounded-full" style={{ background: PLATFORM_COLOR[o.dot] }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Kpis({ report, days, queue, review, questions }: { report?: AnalyticsReport; days: number; queue: number; review: number; questions: number }) {
  const applied = report?.daily.map((d) => Object.values(d.applied).reduce((n, v) => n + (v ?? 0), 0)) ?? [];
  const found = report?.daily.map((d) => d.found) ?? [];
  const cells: ReactNode[] = [
    <Kpi
      key="applied"
      label="Applications sent"
      value={report?.current.applied ?? 0}
      change={report ? trend(report.current.applied, report.previous.applied) : null}
      days={days}
      spark={<Sparkline values={applied} />}
    />,
    <Kpi
      key="found"
      label="Jobs found"
      value={report?.current.found ?? 0}
      change={report ? trend(report.current.found, report.previous.found) : null}
      days={days}
      spark={<Sparkline values={found} color="var(--p-linkedin)" />}
    />,
    <Kpi
      key="match"
      label="Match rate"
      value={report ? pct(report.pipeline.matched, report.pipeline.found) : '-'}
      foot={report ? `${report.pipeline.matched} of ${report.pipeline.found} were worth a look` : ''}
    />,
    <Kpi
      key="waiting"
      label="Waiting"
      value={queue}
      tone={questions > 0 ? 'warn' : undefined}
      foot={
        <span className="flex flex-wrap gap-x-3">
          <Link to="/review?tab=queued" className="hover:text-ink">
            in the queue
          </Link>
          <Link to="/review" className="hover:text-ink">
            {review} to review <ArrowRight className="inline size-3" />
          </Link>
          {questions > 0 && (
            <Link to="/questions" className="font-semibold text-warn">
              {questions} question{questions === 1 ? '' : 's'} for you
            </Link>
          )}
        </span>
      }
    />,
  ];
  return (
    // Hairline dividers from a 1px gap over the line colour, in any column count.
    <Card className="grid grid-cols-2 gap-px overflow-hidden bg-line/60 lg:grid-cols-4">
      {cells.map((c, i) => (
        <div key={i} className="bg-surface px-4 py-4 sm:px-5">
          {c}
        </div>
      ))}
    </Card>
  );
}

function Kpi({
  label,
  value,
  change,
  days,
  spark,
  foot,
  tone,
}: {
  label: string;
  value: number | string;
  change?: number | null;
  days?: number;
  spark?: ReactNode;
  foot?: ReactNode;
  tone?: 'warn';
}) {
  return (
    <div className="flex h-full flex-col">
      <p className="text-[12.5px] text-ink-3">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className={cn('font-display text-[36px] leading-none tabular', tone === 'warn' && 'text-warn')}>{value}</p>
        {change !== undefined && change !== null && (
          <span
            className={cn(
              'mb-1 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold tabular',
              change >= 0 ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad',
            )}
            title={`Compared with the ${days} days before`}
          >
            {change >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <div className="mt-auto pt-3 text-[12px] text-ink-3">{spark ?? foot}</div>
    </div>
  );
}

function ApplicationsChart({ report, loading }: { report?: AnalyticsReport; loading: boolean }) {
  const [metric, setMetric] = useState<'applied' | 'found'>('applied');
  const present = useMemo(() => {
    const seen = new Set<JobPlatform>();
    for (const day of report?.daily ?? []) for (const [p, n] of Object.entries(day.applied)) if (n) seen.add(p as JobPlatform);
    return PLATFORMS.map((p) => p.key).filter((p) => seen.has(p));
  }, [report]);

  const columns: BarColumn[] = (report?.daily ?? []).map((d) => ({
    key: d.day,
    label: shortDay(d.day),
    title: new Date(`${d.day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
    segments:
      metric === 'applied'
        ? present.map((p) => ({ id: p, label: platformLabel(p), value: d.applied[p] ?? 0, color: PLATFORM_COLOR[p] }))
        : [{ id: 'found', label: 'Found', value: d.found, color: 'color-mix(in oklab, var(--accent) 70%, var(--surface))' }],
  }));

  return (
    <Card>
      <CardHeader
        title={metric === 'applied' ? 'Applications per day' : 'Jobs found per day'}
        hint={metric === 'applied' ? 'Hover a day to see the platforms.' : 'New jobs discovered by search, before scoring.'}
        action={
          <div className="flex shrink-0 rounded-full bg-surface-2 p-0.5 text-[12px]">
            {(['applied', 'found'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={cn(
                  'rounded-full px-3 py-0.5 capitalize transition-colors',
                  metric === m ? 'bg-surface font-semibold text-ink shadow-card' : 'text-ink-3',
                )}
              >
                {m}
              </button>
            ))}
          </div>
        }
      />
      <div className="px-5 pt-5 pb-4">
        {loading ? (
          <div className="h-[220px] animate-pulse rounded-xl bg-surface-2/70" />
        ) : (
          <StackedBars columns={columns} height={220} unit={metric === 'applied' ? 'applications' : 'jobs'} empty="Nothing in this range yet" />
        )}
        {metric === 'applied' && present.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
            {present.map((p) => (
              <span key={p} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px]" style={{ background: PLATFORM_COLOR[p] }} />
                {platformLabel(p)}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function MatchQuality({ report, minApply }: { report?: AnalyticsReport; minApply: number }) {
  const buckets = Array.from({ length: 10 }, (_, b) => report?.scores.find((s) => s.bucket === b) ?? { bucket: b, jobs: 0, applied: 0 });
  const scored = buckets.reduce((n, b) => n + b.jobs, 0);
  const strong = buckets.filter((b) => b.bucket * 10 >= minApply).reduce((n, b) => n + b.jobs, 0);
  return (
    <Card>
      <CardHeader
        title="Match quality"
        hint={scored ? `${pct(strong, scored)} of scored jobs reach your apply score of ${minApply}.` : 'How well found jobs fit your profile.'}
      />
      <div className="px-5 pt-5 pb-4">
        <StackedBars
          height={170}
          empty="No scored jobs in this range"
          marker={{ index: Math.min(9, Math.floor(minApply / 10)), label: `apply ≥ ${minApply}` }}
          columns={buckets.map((b) => ({
            key: String(b.bucket),
            label: String(b.bucket * 10),
            title: `Score ${b.bucket * 10}-${b.bucket === 9 ? 100 : b.bucket * 10 + 9}`,
            segments: [
              { id: 'applied', label: 'Applied', value: b.applied, color: 'var(--accent)' },
              {
                id: 'rest',
                label: 'Not applied',
                value: b.jobs - b.applied,
                color: b.bucket * 10 >= minApply ? 'color-mix(in oklab, var(--accent) 35%, var(--surface-2))' : 'var(--line-strong)',
              },
            ],
          }))}
        />
        <div className="mt-3 flex gap-4 text-[12px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-accent" /> Applied
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-line-strong" /> Not applied
          </span>
        </div>
      </div>
    </Card>
  );
}

function RecentActivity() {
  const { events, connected } = useEvents();
  const shown = useMemo(() => events.filter((e) => e.type === 'log').slice(0, 9), [events]);
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader
        title="Recent activity"
        hint={connected ? 'Live from the agent' : 'Reconnecting...'}
        action={
          <Link to="/activity" className="shrink-0 text-[12.5px] text-info hover:underline">
            Full flight log
          </Link>
        }
      />
      <ol className="flex-1 divide-y divide-line/50">
        {shown.length === 0 && <li className="px-5 py-10 text-center text-[13px] text-ink-3">Nothing yet. Start the agent or press "Search now".</li>}
        {shown.map((e) => (
          <li key={e.id} className="log-line flex gap-3 px-5 py-2 text-[13px]">
            <span className="w-11 shrink-0 pt-px font-mono text-[11.5px] text-ink-3 tabular">{clock(e.at).slice(0, 5)}</span>
            <span className={cn('min-w-0 flex-1 break-words', levelColor[e.level])}>
              {e.source && !e.message.startsWith(sourceLabel[e.source] ?? platformLabel(e.source)) && (
                <span className="mr-1.5 text-ink-3">{sourceLabel[e.source] ?? platformLabel(e.source)}</span>
              )}
              {e.message}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
