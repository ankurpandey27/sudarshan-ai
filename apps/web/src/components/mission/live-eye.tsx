// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { api } from '../../lib/api';
import { useEvents } from '../../lib/events';
import { clock, cn, timeUntil } from '../../lib/format';
import type { AgentStatus } from '../../lib/types';
import { Card } from '../ui';

interface LiveApplication {
  jobId: number;
  attemptId: number;
  shots: { index: number; label: string; at: string }[];
}

/**
 * What the agent's browser is doing right now: the newest picture of the application in progress (taken at each
 * step of the form) and the steps as they happen. Nothing is shown that the agent is not really doing.
 */
export function LiveEye({ agent }: { agent: AgentStatus | undefined }) {
  const applying = !!agent?.currentJob;
  const { data: live } = useQuery({
    queryKey: ['live'],
    queryFn: () => api.get<LiveApplication | null>('/agent/live'),
    refetchInterval: applying ? 1500 : 10_000,
  });
  const { events } = useEvents();
  const jobId = live?.jobId ?? agent?.currentJob?.id ?? null;
  const steps = useMemo(() => (jobId ? events.filter((event) => event.type === 'apply.step' && event.jobId === jobId).slice(0, 5) : []), [events, jobId]);
  const lastDone = useMemo(() => events.find((event) => event.type === 'log' && event.level === 'success' && /: Applied/.test(event.message)), [events]);
  const shot = live?.shots.at(-1);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className={cn('size-2 rounded-full', live || applying ? 'live-dot bg-bad' : 'bg-ink-3/50')} />
        <span className="font-mono text-[10.5px] tracking-[0.16em] text-ink-2 uppercase">Live eye</span>
        <span className="ml-auto truncate text-[11.5px] text-ink-3">
          {agent?.currentJob ? `${agent.currentJob.company}${live?.shots.length ? ` · step ${live.shots.length}` : ''}` : 'watching'}
        </span>
      </div>

      <div className="relative m-3 aspect-[16/10] overflow-hidden rounded-lg border border-line bg-surface-2">
        {live && shot ? (
          <>
            <img
              key={`${live.attemptId}-${shot.index}`}
              src={`/api/agent/live/shots/${live.attemptId}/${shot.index}`}
              alt={`The agent's browser: ${shot.label}`}
              className="absolute inset-0 size-full animate-[mission-rise_.3s_ease-out] object-cover object-top"
            />
            <div className="live-scan pointer-events-none absolute inset-x-0 h-8" />
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div>
              <Eye className="mx-auto size-6 text-ink-3" />
              <p className="mt-2 text-[12.5px] text-ink-2">
                {applying
                  ? 'Opening the job - the first picture appears at the first form step.'
                  : !agent?.running
                    ? 'Sudarshan AI is resting. Start the agent and the next application plays here, step by step.'
                    : agent.queue
                      ? `Next application ${agent.nextApplyAt ? timeUntil(agent.nextApplyAt) : 'soon'} - it plays here live.`
                      : 'Nothing approved to apply to. Approve jobs on the radar or with the command bar.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-3.5">
        {steps.length ? (
          <ol className="space-y-1">
            {steps.map((step, index) => (
              <li key={step.id} className={cn('flex gap-2 text-[12px]', index === 0 ? 'text-ink' : 'text-ink-3')}>
                <span className="shrink-0 font-mono text-[10.5px] tabular text-ink-3">{clock(step.at)}</span>
                <span className="line-clamp-2">{step.message}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[12px] text-ink-3">{lastDone ? `Last: ${lastDone.message}` : 'Each step of an application shows here as it happens.'}</p>
        )}
      </div>
    </Card>
  );
}
