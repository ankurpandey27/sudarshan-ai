// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pause, Play } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/format';
import { useAgent } from '../lib/queries';
import type { AgentPhase, AgentStatus } from '../lib/types';
import { useToast } from './toast';
import { InfoTip } from './info-tip';

const phaseText: Record<AgentPhase, string> = {
  stopped: 'Stopped',
  idle: 'Watching for jobs',
  discovering: 'Searching job boards',
  applying: 'Applying',
  waiting: 'Pausing between applications',
  sleeping: 'Outside active hours',
};

export function AgentToggle({ compact }: { compact?: boolean }) {
  const { data } = useAgent();
  const qc = useQueryClient();
  const toast = useToast();
  const toggle = useMutation({
    mutationFn: () => api.post<AgentStatus>(data?.running ? '/agent/stop' : '/agent/start'),
    onSuccess: (s) => {
      qc.setQueryData(['agent'], s);
      toast('ok', s.running ? 'Agent started - watch it in the flight log' : 'Agent stopped');
    },
    onError: (e: Error) => toast('error', e.message),
  });
  const running = data?.running ?? false;
  const phase = data?.phase ?? 'stopped';

  return (
    <div className={cn('rounded-xl border p-3', running ? 'border-accent/40 bg-accent-soft/60' : 'border-line bg-surface')}>
      <div className="flex items-center gap-2">
        <span className={cn('size-2 rounded-full', running ? 'live-dot bg-accent' : 'bg-ink-3')} />
        <span className="flex-1 text-[13px] font-semibold">{running ? 'Sudarshan is out working' : 'Sudarshan is resting'}</span>
        <InfoTip title={running ? 'Stop agent' : 'Start agent'} align="left" side="top">
          While running, Sudarshan searches for new jobs on a schedule and applies to your approved jobs one at a time, with pauses in between, within your
          daily limits and active hours. Stopping pauses it; an application already in progress finishes first. Nothing is lost - it picks up where it left off.
        </InfoTip>
      </div>
      {!compact && (
        <p className="mt-1 truncate text-[12.5px] text-ink-2" title={data?.currentJob ? `${data.currentJob.title} @ ${data.currentJob.company}` : undefined}>
          {phase === 'applying' && data?.currentJob ? `${data.currentJob.title} @ ${data.currentJob.company}` : phaseText[phase]}
        </p>
      )}
      <button
        onClick={() => toggle.mutate()}
        disabled={toggle.isPending}
        className={cn(
          'mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-60',
          running ? 'border border-line-strong bg-surface text-ink hover:bg-surface-2' : 'bg-accent text-accent-ink hover:brightness-105',
        )}
      >
        {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        {toggle.isPending ? 'Working...' : running ? 'Stop agent' : 'Start agent'}
      </button>
    </div>
  );
}
