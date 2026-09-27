// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useAnswers } from '../lib/queries';
import type { Answer } from '../lib/types';
import { Badge, Button, Card, Empty, Input, PageTitle, Textarea } from '../components/ui';
import { useToast } from '../components/toast';

const sourceTone = { user: 'good', excel: 'info', llm: 'accent' } as const;
const sourceText = { user: 'you', excel: 'excel', llm: 'AI' } as const;

export function AnswersPage() {
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const { data = [], isLoading } = useAnswers(search);
  return (
    <>
      <PageTitle
        title="Answer memory"
        sub="Every screening question the agent has learned. Similar questions reuse these answers - no AI call, no guessing."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
            Add answer
          </Button>
        }
      />
      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-ink-3" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions or answers" className="pl-8" />
      </div>
      {adding && <NewAnswer onDone={() => setAdding(false)} />}
      <Card>
        {!isLoading && data.length === 0 && (
          <Empty icon={<BookOpenCheck className="size-7" />} title="Memory is empty">
            It fills as you answer questions, import an Excel answer sheet, or let the AI answer reusable questions.
          </Empty>
        )}
        <ul>
          {data.map((a) => (
            <AnswerRow key={a.id} a={a} />
          ))}
        </ul>
      </Card>
    </>
  );
}

function AnswerRow({ a }: { a: Answer }) {
  const [value, setValue] = useState(a.answer);
  const qc = useQueryClient();
  const toast = useToast();
  const save = useMutation({
    mutationFn: () => api.patch(`/answers/${a.id}`, { answer: value }),
    onSuccess: () => {
      toast('ok', 'Answer updated');
      void qc.invalidateQueries({ queryKey: ['answers'] });
    },
    onError: (e: Error) => toast('error', e.message),
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/answers/${a.id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['answers'] }),
  });
  const dirty = value !== a.answer;
  return (
    <li className="grid gap-2 border-b border-line px-4 py-3 last:border-b-0 md:grid-cols-[1fr_1fr_auto] md:items-start">
      <div>
        <p className="text-[13.5px] font-medium">{a.question}</p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
          <Badge tone={sourceTone[a.source]}>from {sourceText[a.source]}</Badge>
          used {a.uses}x - {timeAgo(a.updatedAt)}
        </p>
      </div>
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={value.length > 80 ? 3 : 1} className="min-h-9" />
      <div className="flex gap-1">
        {dirty && (
          <Button size="sm" variant="primary" onClick={() => save.mutate()} loading={save.isPending}>
            Save
          </Button>
        )}
        <button aria-label="Delete answer" onClick={() => remove.mutate()} className="rounded-lg p-2 text-ink-3 hover:bg-bad-soft hover:text-bad">
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

function NewAnswer({ onDone }: { onDone: () => void }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const qc = useQueryClient();
  const toast = useToast();
  const add = useMutation({
    mutationFn: () => api.post('/answers', { question, answer }),
    onSuccess: () => {
      toast('ok', 'Learned');
      void qc.invalidateQueries({ queryKey: ['answers'] });
      onDone();
    },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <Card className="mb-3 grid gap-2 p-4 md:grid-cols-[1fr_1fr_auto]">
      <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder='Question, e.g. "Do you have a valid passport?"' autoFocus />
      <Input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer" />
      <div className="flex gap-1">
        <Button variant="primary" onClick={() => add.mutate()} loading={add.isPending} disabled={!question.trim() || !answer.trim()}>
          Add
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
