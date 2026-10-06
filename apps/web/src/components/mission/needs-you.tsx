// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { cn, timeAgo } from '../../lib/format';
import { useJobs, useQuestions } from '../../lib/queries';
import type { Job, PendingQuestion } from '../../lib/types';
import { Card } from '../ui';
import { useToast } from '../toast';

/** Everything waiting on you, answerable right here: questions in one tap, hand-overs with their tab. */
export function NeedsYou() {
  const { data: questions } = useQuestions();
  const { data: handed } = useJobs({ status: 'manual', sort: 'recent', limit: 3 });
  const { data: openTabs } = useQuery({ queryKey: ['open-tabs'], queryFn: () => api.get<number[]>('/agent/open-tabs'), refetchInterval: 10_000 });
  const asked = questions ?? [];
  // "Do by hand" jobs: a captcha, a login, a site Sudarshan could not finish. Continue only where the tab is still open.
  const waiting = handed?.items ?? [];
  const total = asked.length + (handed?.total ?? 0);

  return (
    <Card>
      <div className="flex items-center justify-between px-4 pt-3.5">
        <span className={cn('font-mono text-[10.5px] tracking-[0.16em] uppercase', total ? 'text-warn' : 'text-ink-3')}>Needs you · {total}</span>
        <span className="text-[11px] text-ink-3">answer once, remembered</span>
      </div>
      <div className="space-y-2 p-3">
        {total === 0 && (
          <p className="flex items-center gap-2 rounded-lg bg-surface-2/60 px-3 py-2.5 text-[12.5px] text-ink-2">
            <CheckCircle2 className="size-4 text-good" /> Nothing is waiting on you.
          </p>
        )}
        {asked.slice(0, 2).map((question, index) => (
          <QuestionRow key={question.key} question={question} glow={index === 0} />
        ))}
        {waiting.slice(0, 2).map((job) => (
          <HandOverRow key={job.id} job={job} tabOpen={!!openTabs?.includes(job.id)} />
        ))}
        {(asked.length > 2 || (handed?.total ?? 0) > 2) && (
          <div className="flex gap-3 px-1 text-[12px]">
            {asked.length > 2 && (
              <Link to="/questions" className="text-info hover:underline">
                All {asked.length} questions
              </Link>
            )}
            {(handed?.total ?? 0) > 2 && (
              <Link to="/applications?tab=attention" className="text-info hover:underline">
                All {handed!.total} to do by hand
              </Link>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function QuestionRow({ question, glow }: { question: PendingQuestion; glow: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [value, setValue] = useState(question.suggestion ?? '');
  const answer = useMutation({
    mutationFn: (text: string) => api.post<{ requeued: number }>('/questions/answer', { key: question.key, answer: text }),
    onSuccess: (result) => {
      toast('ok', result.requeued ? `Saved - ${result.requeued} job(s) carry on` : 'Saved to answer memory');
      for (const key of ['questions', 'jobs', 'agent', 'insights', 'answers']) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (error: Error) => toast('error', error.message),
  });
  const options = question.optionsEn?.length ? question.optionsEn : question.options;
  const unblocks = question.jobIds.length;
  return (
    <div className={cn('rounded-xl border border-line bg-gradient-to-r from-warn-soft/60 to-transparent px-3 py-2.5 shadow-[inset_2px_0_0_var(--warn)]', glow && 'needs-glow')}>
      <p className="text-[12.5px] text-ink">{question.questionEn ?? question.question}</p>
      {options.length > 0 && options.length <= 6 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {options.map((option, index) => (
            <button
              key={option}
              type="button"
              disabled={answer.isPending}
              onClick={() => answer.mutate(question.options[index] ?? option)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11.5px] transition-colors disabled:opacity-50',
                question.suggestion === (question.options[index] ?? option) ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink hover:border-accent',
              )}
            >
              {option}
            </button>
          ))}
          <span className="ml-auto font-mono text-[10.5px] text-ink-3">unblocks {unblocks}</span>
        </div>
      ) : (
        <form
          className="mt-2 flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            if (value.trim()) answer.mutate(value.trim());
          }}
        >
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Your answer"
            aria-label={question.question}
            className="h-7 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-[12px] outline-none focus:border-accent"
          />
          <button type="submit" disabled={!value.trim() || answer.isPending} className="h-7 rounded-md bg-accent px-2.5 text-[12px] font-medium text-accent-ink disabled:opacity-50">
            Save
          </button>
          <span className="font-mono text-[10.5px] text-ink-3">×{unblocks}</span>
        </form>
      )}
    </div>
  );
}

function HandOverRow({ job, tabOpen }: { job: Job; tabOpen: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const carryOn = useMutation({
    mutationFn: () => api.post<{ status: string; detail: string }>(`/agent/continue/${job.id}`),
    onSuccess: (result) => {
      toast(result.status === 'applied' ? 'ok' : 'error', result.detail);
      for (const key of ['jobs', 'open-tabs', 'agent', 'stats']) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (error: Error) => toast('error', error.message),
  });
  const open = useMutation({ mutationFn: () => api.post('/browser/open', { url: job.applyUrl ?? job.url }), onError: (error: Error) => toast('error', error.message) });
  return (
    <div className="rounded-xl border border-line px-3 py-2.5 shadow-[inset_2px_0_0_var(--warn)]">
      <p className="text-[12.5px] text-ink">
        {job.title} <span className="text-ink-3">· {job.company}</span>
      </p>
      <p className="mt-0.5 line-clamp-2 text-[11.5px] text-ink-3">{job.reason ?? 'Waiting for you in its tab'}</p>
      <div className="mt-2 flex items-center gap-1.5">
        {tabOpen && (
          <button type="button" onClick={() => carryOn.mutate()} disabled={carryOn.isPending} className="h-7 rounded-md bg-accent px-2.5 text-[12px] font-medium text-accent-ink disabled:opacity-50">
            Continue
          </button>
        )}
        <button type="button" onClick={() => open.mutate()} className="h-7 rounded-md border border-line px-2.5 text-[12px] text-ink-2 hover:bg-surface-2">
          Open in agent browser
        </button>
        <span className="ml-auto font-mono text-[10.5px] text-ink-3">{timeAgo(job.updatedAt)}</span>
      </div>
    </div>
  );
}
