// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, X } from 'lucide-react';
import { api } from '../../lib/api';
import { parseCommand, type CommandIntent } from '../../lib/command';
import { cn } from '../../lib/format';
import { useDebounced } from '../../lib/use-debounced';
import { useJobs } from '../../lib/queries';
import { useToast } from '../toast';

const EXAMPLES = [
  'apply to remote jobs in my country above 80, skip anything asking Java',
  'show hybrid jobs on LinkedIn found this week',
  'approve Naukri jobs 85+ without PHP or Angular',
  'remote jobs abroad from the last 3 days',
];

/** The filters a sentence asks for, as the jobs API takes them. */
export function intentFilters(intent: CommandIntent) {
  return {
    workMode: intent.workMode.join(',') || undefined,
    region: intent.region ?? undefined,
    minScore: intent.minScore ?? undefined,
    platform: intent.platform ?? undefined,
    withinDays: intent.withinDays ?? undefined,
    exclude: intent.exclude.join(',') || undefined,
  };
}

/**
 * Say what you want in a sentence. It is read on this computer without AI, so it works with every model or none:
 * the chips show what was understood, the radar lights up the matches, and Enter approves them (or shows them).
 */
export function CommandBar({ country, onMatches }: { country: string | null; onMatches: (ids: Set<number> | null) => void }) {
  const [text, setText] = useState('');
  const [example, setExample] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const settled = useDebounced(text.trim(), 250);
  const intent = useMemo(() => (settled ? parseCommand(settled, country) : null), [settled, country]);
  const active = !!intent?.understood.length;
  const filters = intent ? intentFilters(intent) : {};
  const { data: matches, isFetching } = useJobs({ status: 'review', sort: 'score', limit: 200, ...filters }, { enabled: active });
  const total = active ? (matches?.total ?? 0) : 0;

  useEffect(() => {
    onMatches(active && matches ? new Set(matches.items.map((job) => job.id)) : null);
  }, [active, matches, onMatches]);

  // Ctrl+K (or Cmd+K) jumps here from anywhere on the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (text) return;
    const timer = window.setInterval(() => setExample((current) => (current + 1) % EXAMPLES.length), 4500);
    return () => window.clearInterval(timer);
  }, [text]);

  const approve = useMutation({
    mutationFn: () =>
      api.post<{ updated: number }>('/jobs/approve-strong', {
        minScore: intent!.minScore ?? 0,
        ...(intent!.platform ? { platform: intent!.platform } : {}),
        ...(intent!.workMode.length ? { workMode: intent!.workMode } : {}),
        ...(intent!.region ? { region: intent!.region } : {}),
        ...(intent!.withinDays ? { withinDays: intent!.withinDays } : {}),
        ...(intent!.exclude.length ? { exclude: intent!.exclude } : {}),
      }),
    onSuccess: (result) => {
      toast('ok', `${result.updated} job(s) queued - ${result.updated ? 'the agent applies to them in order' : 'nothing matched'}`);
      setText('');
      for (const key of ['jobs', 'stats', 'agent', 'insights']) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (error: Error) => toast('error', error.message),
  });

  // Review keeps the filters it can show (work type, where, how recent); score and excluded words stay on the radar.
  const showInReview = () => {
    try {
      localStorage.setItem('sudarshan.review.workMode', JSON.stringify(intent?.workMode.length === 1 ? intent.workMode[0] : ''));
      localStorage.setItem('sudarshan.review.region', JSON.stringify(intent?.region ?? ''));
      localStorage.setItem('sudarshan.review.withinDays', JSON.stringify(intent?.withinDays && [1, 3, 7, 30].includes(intent.withinDays) ? intent.withinDays : 0));
    } catch {
      // Not remembered - Review opens with its own filters.
    }
    navigate('/review');
  };

  const run = () => {
    if (!active || approve.isPending) return;
    if (intent!.approve) {
      if (total) approve.mutate();
      else toast('error', 'Nothing in Review matches that');
    } else showInReview();
  };

  return (
    <div className="rounded-xl border border-accent/25 bg-surface shadow-[0_0_30px_-14px_var(--accent)]">
      <div className="flex items-center gap-2.5 px-3.5">
        <ChevronRight className="size-4 shrink-0 text-accent" />
        <input
          ref={input}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') run();
            if (event.key === 'Escape') setText('');
          }}
          placeholder={EXAMPLES[example]}
          aria-label="Tell Sudarshan AI what to do"
          className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
        />
        {text ? (
          <button type="button" onClick={() => setText('')} aria-label="Clear" className="text-ink-3 hover:text-ink">
            <X className="size-4" />
          </button>
        ) : (
          <kbd className="rounded border border-line px-1.5 font-mono text-[10.5px] text-ink-3">Ctrl K</kbd>
        )}
      </div>
      {settled && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-3.5 py-2 text-[12px]">
          {active ? (
            <>
              {intent!.understood.map((chip) => (
                <span key={chip} className="rounded-full bg-accent-soft px-2 py-0.5 text-ink">
                  {chip}
                </span>
              ))}
              <span className={cn('ml-1 text-ink-3', isFetching && 'opacity-60')}>
                {total} match{total === 1 ? '' : 'es'} in Review{total > 200 ? ' (200 lit on the radar)' : ''}
              </span>
              <button
                type="button"
                onClick={run}
                disabled={approve.isPending || (intent!.approve && !total)}
                className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md bg-accent px-2.5 font-medium text-accent-ink disabled:opacity-50"
              >
                {intent!.approve ? `Approve ${total}` : 'Show in Review'} <kbd className="font-mono text-[10px] opacity-70">↵</kbd>
              </button>
            </>
          ) : (
            <span className="text-ink-3">
              Not understood yet. Try words like <b className="font-medium text-ink-2">remote</b>, <b className="font-medium text-ink-2">hybrid</b>,{' '}
              <b className="font-medium text-ink-2">{country ? `in ${country}` : 'in my country'}</b>, <b className="font-medium text-ink-2">abroad</b>,{' '}
              <b className="font-medium text-ink-2">above 80</b>, a site name, <b className="font-medium text-ink-2">this week</b>, or{' '}
              <b className="font-medium text-ink-2">skip anything asking Java</b>.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
