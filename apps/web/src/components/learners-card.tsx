// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useLearners } from '../lib/queries';
import type { LearnerStatus } from '../lib/types';
import { InfoTip } from './info-tip';
import { useToast } from './toast';
import { Badge, Button, Card, CardHeader, Toggle } from './ui';

const MODE: Record<LearnerStatus['mode'], { text: string; tone: 'good' | 'warn' | 'neutral' | 'info' }> = {
  on: { text: 'On', tone: 'good' },
  checking: { text: 'Checking itself', tone: 'info' },
  learning: { text: 'Collecting examples', tone: 'neutral' },
  off: { text: 'Off', tone: 'neutral' },
};

/** The learners: small models that train on this computer from what Sudarshan does every day. */
export function LearnersCard() {
  const { data } = useLearners();
  const qc = useQueryClient();
  const toast = useToast();
  const set = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) => api.patch<LearnerStatus[]>(`/learners/${name}`, { enabled }),
    onSuccess: (r) => qc.setQueryData(['learners'], r),
    onError: (e: Error) => toast('error', e.message),
  });
  const train = useMutation({
    mutationFn: () => api.post<LearnerStatus[]>('/learners/train'),
    onSuccess: (r) => {
      qc.setQueryData(['learners'], r);
      toast('ok', 'Trained on everything so far');
    },
    onError: (e: Error) => toast('error', e.message),
  });
  if (!data) return null;
  return (
    <Card>
      <CardHeader
        title="Learning from your applications"
        hint="Small models trained on this computer from what Sudarshan does every day. Each acts only once it has proven itself."
        action={
          <div className="flex shrink-0 items-center gap-2">
            <InfoTip title="How they learn" align="right">
              Every field a rule fills, every question you answer, every button that got an application through (or into a dead end) and every attempt's result
              is an example. Each learner retrains every few hours. It first <b>checks itself</b> on cases it has not seen - it acts only when it is right often
              enough (95% for the first three), and goes back to checking if it slips. Nothing leaves your computer.
            </InfoTip>
            <Button size="sm" variant="ghost" className="whitespace-nowrap" loading={train.isPending} onClick={() => train.mutate()}>
              Train now
            </Button>
          </div>
        }
      />
      <ul className="divide-y divide-line">
        {data.map((l) => (
          <li key={l.name} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
                {l.label}
                <Badge tone={MODE[l.mode].tone}>{MODE[l.mode].text}</Badge>
              </p>
              <p className="mt-0.5 text-[12px] text-ink-2">{l.note}</p>
              <p className="mt-0.5 text-[12px] text-ink-3 tabular">
                {l.examples} example{l.examples === 1 ? '' : 's'}
                {l.needed > 0 ? ` - ${l.needed} more to start` : ''}
                {l.metrics?.accuracy != null ? ` · right ${Math.round(l.metrics.accuracy * 100)}% on ${l.metrics.how}` : ''}
                {l.trainedAt ? ` · trained ${timeAgo(l.trainedAt)}` : ''}
              </p>
            </div>
            <Toggle checked={l.enabled} onChange={(v) => set.mutate({ name: l.name, enabled: v })} label="" />
          </li>
        ))}
      </ul>
    </Card>
  );
}
