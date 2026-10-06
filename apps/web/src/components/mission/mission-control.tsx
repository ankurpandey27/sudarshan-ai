// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { cn, PLATFORMS } from '../../lib/format';
import { useAgent, useJobs, useProfile, useSettings, useStats } from '../../lib/queries';
import type { Job } from '../../lib/types';
import { PLATFORM_COLOR } from '../platform-badge';
import { Card } from '../ui';
import { InfoTip } from '../info-tip';
import { useToast } from '../toast';
import { CommandBar } from './command-bar';
import { FlightRecorder } from './flight-recorder';
import { LiveEye } from './live-eye';
import { NeedsYou } from './needs-you';
import { Radar, type RadarAction, type SiteLimit } from './radar';
import './mission.css';

const RADAR_LIMIT = 200;
const DONE: Record<RadarAction, string> = {
  approve: 'Approved - queued to apply',
  skip: 'Skipped',
  dismiss: 'Dismissed',
  unqueue: 'Moved back to review',
  'apply-now': 'Applying now',
};

/** Lakshya's mission control: the radar, the Live Eye, what needs you, and today's flight recorder. */
export function MissionControl() {
  const { data: agent } = useAgent();
  const { data: stats } = useStats();
  const { data: settings } = useSettings();
  const { data: profile } = useProfile();
  const { data: jobs } = useJobs({ status: 'review,approved,applying', sort: 'score', limit: RADAR_LIMIT });
  const [highlight, setHighlight] = useState<Set<number> | null>(null);
  const onMatches = useCallback((ids: Set<number> | null) => setHighlight(ids), []);
  const qc = useQueryClient();
  const toast = useToast();
  const country = profile?.profile.country?.trim() || null;

  const act = useMutation({
    mutationFn: ({ action, job }: { action: RadarAction; job: Job }) =>
      action === 'apply-now' ? api.post<{ status: string; detail: string }>(`/agent/apply/${job.id}`) : api.post(`/jobs/${action}`, { ids: [job.id] }),
    onSuccess: (result, { action, job }) => {
      const detail = (result as { detail?: string } | null)?.detail;
      toast('ok', `${DONE[action]}: ${job.title}${detail ? ` - ${detail}` : ''}`);
      for (const key of ['jobs', 'stats', 'agent', 'insights']) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (error: Error) => toast('error', error.message),
  });
  const onAct = useCallback((action: RadarAction, job: Job) => act.mutate({ action, job }), [act]);

  const limits: SiteLimit[] = PLATFORMS.map((platform) => {
    const source = settings?.sources[platform.setting];
    return {
      key: platform.key,
      label: platform.label,
      color: PLATFORM_COLOR[platform.key],
      done: stats?.appliedTodayByPlatform[platform.key] ?? 0,
      limit: source?.enabled ? source.dailyLimit : 0,
      enabled: source?.enabled ?? false,
    };
  });
  const waiting = (stats?.byStatus.review ?? 0) + (stats?.byStatus.approved ?? 0);

  return (
    <div className="space-y-4">
      <CommandBar country={country} onMatches={onMatches} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="mission-stage relative flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line/70 px-5 py-3">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[10.5px] tracking-[0.16em] text-ink-3 uppercase">Today</span>
              <AppliedCount value={stats?.appliedToday ?? agent?.appliedToday ?? 0} />
            </div>
            <Readout value={stats?.memoryHitRate === null || stats?.memoryHitRate === undefined ? '-' : `${Math.round(stats.memoryHitRate * 100)}%`} label="filled without AI" tone="text-good" />
            <Readout value={String(agent?.queue ?? 0)} label="queued" />
            <Readout value={String(stats?.byStatus.review ?? 0)} label="to review" />
            <div className="ml-auto">
              <InfoTip title="Reading the radar">
                Every dot is a job waiting for you or queued to apply - the {Math.min(RADAR_LIMIT, waiting)} best matches are shown. <b>Closer to the chakra is a better match</b>{' '}
                (the rings are 90+, 80+, 70+ and 50+). <b>Left: {country ?? 'your country'}. Right: abroad.</b> Jobs that do not say where sit at the bottom. A ring around a
                dot means it is queued. While the agent runs, the sweep circles and each application flies out as a comet, landing on the rim - green when it went through,
                orange when it needs you, red when it failed. The arcs on the rim are each site's daily limit. Hover a dot for its card; click to keep it open; A approves,
                S skips, X dismisses.
              </InfoTip>
            </div>
          </div>

          <div className="flex-1 px-3 py-4 sm:px-8">
            <Radar
              jobs={jobs?.items ?? []}
              running={!!agent?.running}
              phase={agent?.phase ?? 'stopped'}
              applyingJobId={agent?.currentJob?.id ?? null}
              limits={limits}
              country={country}
              highlight={highlight}
              onAct={onAct}
              busy={act.isPending}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line/70 px-5 py-2.5 text-[11.5px] text-ink-2">
            {PLATFORMS.map((platform) => (
              <span key={platform.key} className="inline-flex items-center gap-1.5">
                <i className="size-2 rounded-full" style={{ background: PLATFORM_COLOR[platform.key] }} />
                {platform.label}
              </span>
            ))}
            {waiting > RADAR_LIMIT && <span className="ml-auto text-ink-3">Showing the {RADAR_LIMIT} best of {waiting}</span>}
          </div>
        </Card>

        <div className="space-y-4">
          <LiveEye agent={agent} />
          <NeedsYou />
        </div>
      </div>

      <FlightRecorder startHour={settings?.agent.activeHoursStart ?? 8} endHour={settings?.agent.activeHoursEnd ?? 23} />
    </div>
  );
}

/** One number with its label, in the radar's top strip. */
function Readout({ value, label, tone = 'text-ink' }: { value: string; label: string; tone?: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <b className={cn('font-mono text-[14px] font-normal tabular', tone)}>{value}</b>
      <span className="text-[11.5px] text-ink-3">{label}</span>
    </span>
  );
}

/** Today's count, with a small lift each time it goes up. */
function AppliedCount({ value }: { value: number }) {
  const previous = useRef(value);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (value > previous.current) setBump((count) => count + 1);
    previous.current = value;
  }, [value]);
  const label = useMemo(() => `${value}`, [value]);
  return (
    <div className="flex items-baseline gap-1.5">
      <span key={bump} className={cn('font-display text-[34px] leading-[0.9] tabular', bump > 0 && 'count-bump')}>
        {label}
      </span>
      <span className="text-[11.5px] text-ink-3">applied</span>
    </div>
  );
}
