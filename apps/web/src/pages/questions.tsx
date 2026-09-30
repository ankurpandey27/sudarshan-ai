// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircleQuestion } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/format';
import { useQuestions } from '../lib/queries';
import type { PendingQuestion } from '../lib/types';
import { Badge, Button, Card, Empty, Input, PageTitle, Textarea } from '../components/ui';
import { useToast } from '../components/toast';

export function Questions() {
  const { data = [], isLoading } = useQuestions();
  return (
    <>
      <PageTitle title="Questions" sub="Things only you can answer. Each answer is remembered forever and unblocks every job that asked it." />
      {!isLoading && data.length === 0 && (
        <Card>
          <Empty icon={<MessageCircleQuestion className="size-7" />} title="No questions right now">
            When an application asks something your profile and memory cannot answer, it shows up here instead of being guessed.
          </Empty>
        </Card>
      )}
      <div className="space-y-3">
        {data.map((q) => (
          <QuestionCard key={q.key} q={q} />
        ))}
      </div>
    </>
  );
}

function QuestionCard({ q }: { q: PendingQuestion }) {
  const [value, setValue] = useState(q.suggestion ?? '');
  const qc = useQueryClient();
  const toast = useToast();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['questions'] });
    void qc.invalidateQueries({ queryKey: ['agent'] });
    void qc.invalidateQueries({ queryKey: ['jobs'] });
  };
  const answer = useMutation({
    mutationFn: () => api.post<{ requeued: number }>('/questions/answer', { key: q.key, answer: value }),
    onSuccess: (r) => {
      toast('ok', `Remembered. ${r.requeued} job(s) back in the queue.`);
      refresh();
    },
    onError: (e: Error) => toast('error', e.message),
  });
  const skip = useMutation({
    mutationFn: () => api.post('/questions/skip', { key: q.key }),
    onSuccess: () => {
      toast('ok', 'Skipped - those jobs moved to "do by hand"');
      refresh();
    },
  });
  const multi = q.fieldType === 'checkbox-group';
  const picked = new Set(value.split(' | ').filter(Boolean));

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="max-w-3xl">
          <p className="font-display text-[22px] leading-snug">{q.question}</p>
          {q.questionEn && q.questionEn.trim().toLowerCase() !== q.question.trim().toLowerCase() && (
            <p className="mt-0.5 text-[14px] text-ink-2">
              <span className="font-semibold text-ink-3">In English: </span>
              {q.questionEn}
            </p>
          )}
        </div>
        <Badge tone="warn">
          blocking {q.jobIds.length} job{q.jobIds.length === 1 ? '' : 's'}
        </Badge>
      </div>
      <p className="mt-1 truncate text-[12.5px] text-ink-3">
        Asked by{' '}
        {q.jobs
          .slice(0, 3)
          .map((j) => `${j.title} @ ${j.company}`)
          .join(', ')}
        {q.jobs.length > 3 ? ` and ${q.jobs.length - 3} more` : ''}
      </p>

      <div className="mt-3">
        {q.options.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {q.options.map((o, i) => {
              const on = multi ? picked.has(o) : value === o;
              // The option as the site wrote it (that is what is sent), with its English beside it.
              const en = q.optionsEn?.[i];
              return (
                <button
                  key={o}
                  onClick={() => {
                    if (!multi) return setValue(o);
                    const next = new Set(picked);
                    if (on) next.delete(o);
                    else next.add(o);
                    setValue([...next].join(' | '));
                  }}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-[13px] transition-colors',
                    on ? 'border-accent bg-accent-soft font-semibold' : 'border-line-strong hover:bg-surface-2',
                  )}
                >
                  {o}
                  {en && en.trim().toLowerCase() !== o.trim().toLowerCase() && <span className="ml-1 text-ink-3">({en})</span>}
                </button>
              );
            })}
          </div>
        ) : q.fieldType === 'textarea' ? (
          <Textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="Your answer (used for this and similar questions)" rows={4} />
        ) : (
          <Input
            type={q.fieldType === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Your answer"
            className="max-w-md"
          />
        )}
        {q.suggestion && <p className="mt-1.5 text-[12px] text-ink-3">Pre-filled with the AI's suggestion - check it before saving.</p>}
      </div>

      <div className="mt-3 flex gap-2">
        <Button variant="primary" onClick={() => answer.mutate()} loading={answer.isPending} disabled={!value.trim()}>
          Save answer
        </Button>
        <Button variant="ghost" onClick={() => skip.mutate()} loading={skip.isPending}>
          Skip these jobs
        </Button>
      </div>
    </Card>
  );
}
