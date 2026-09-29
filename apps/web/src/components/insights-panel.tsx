// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Wrench, X } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/format';
import { useInsights } from '../lib/queries';
import type { Insight } from '../lib/types';
import { Button } from './ui';
import { useToast } from './toast';

const tone = {
  error: { box: 'border-bad/35 bg-bad-soft/60', icon: <AlertOctagon className="size-4 text-bad" />, label: 'Blocking' },
  warn: { box: 'border-warn/35 bg-warn-soft/60', icon: <AlertTriangle className="size-4 text-warn" />, label: 'Needs you' },
  info: { box: 'border-line bg-surface', icon: <Info className="size-4 text-info" />, label: 'Tip' },
} as const;

/** Everything that needs you; `heading` is off on the Needs attention page, which has its own title. */
export function InsightsPanel({ heading = true }: { heading?: boolean }) {
  const { data, isLoading } = useInsights();
  if (isLoading) return null;
  const items = data ?? [];
  if (items.length === 0) {
    return (
      <div className="mb-5 flex items-center gap-2 rounded-2xl border border-good/25 bg-good-soft/50 px-5 py-3 text-[13.5px]">
        <CheckCircle2 className="size-4 text-good" />
        <span>
          <b>All clear.</b> Nothing is blocking the agent.
        </span>
      </div>
    );
  }
  return (
    <section className="mb-5" aria-label="What needs attention">
      {heading && (
        <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink-3">
          <Wrench className="size-3.5" /> What needs attention
        </h2>
      )}
      <div className="space-y-2">
        {items.map((i) => (
          <InsightCard key={i.id} insight={i} />
        ))}
      </div>
    </section>
  );
}

function InsightCard({ insight: i }: { insight: Insight }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  // Dealt with: hidden until the situation changes (a new count, a new episode), then it comes back.
  const dismiss = useMutation({
    mutationFn: () => api.post(`/agent/insights/${encodeURIComponent(i.id)}/dismiss`, { version: i.version }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['insights'] }),
    onError: (e: Error) => toast('error', e.message),
  });
  const run = useMutation({
    mutationFn: (path: string) => api.post<{ rescored?: number }>(path),
    onSuccess: (r) => {
      toast('ok', typeof r?.rescored === 'number' ? `Scoring ${r.rescored} job(s) - the progress bar shows how far it has got` : 'Done');
      dismiss.mutate();
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast('error', e.message),
  });
  const t = tone[i.severity];
  return (
    <article className={cn('relative rounded-2xl border px-5 py-3.5 pr-11', t.box)}>
      <button
        type="button"
        onClick={() => dismiss.mutate()}
        disabled={dismiss.isPending}
        aria-label={`Dismiss: ${i.title}`}
        title="Dismiss - it comes back if this happens again"
        className="absolute top-2.5 right-2.5 rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-50"
      >
        <X className="size-4" />
      </button>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span className="mt-0.5">{t.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-snug">{i.title}</p>
          <p className="mt-0.5 text-[13px] text-ink-2">{i.detail}</p>
          <p className="mt-1.5 text-[13px]">
            <span className="font-semibold">How to fix: </span>
            {i.fix}
          </p>
        </div>
        {i.actions.length > 0 && (
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {i.actions.map((a) => (
              <Button
                key={a.label}
                size="sm"
                variant={i.severity === 'error' ? 'primary' : 'secondary'}
                loading={run.isPending && run.variables === a.api}
                onClick={() => {
                  if (a.api) return run.mutate(a.api);
                  // Going to deal with it: the card has done its job.
                  dismiss.mutate();
                  if (a.to) navigate(a.to);
                }}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
